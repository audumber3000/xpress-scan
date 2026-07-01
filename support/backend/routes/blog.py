"""AI Blog Studio — generate blog drafts with Claude, review/edit, publish to Sanity.

Human-in-the-loop: /generate creates a DRAFT; nothing goes live until an admin
reviews and calls /publish.
"""
import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from database import get_db, engine
from models import SupportBlogPost
from routes.auth import get_current_admin
from services.ai_content import generate_blog_post
from services.sanity_client import publish_to_sanity, sanity_configured

router = APIRouter()


def _ensure_table():
    try:
        if not inspect(engine).has_table("support_blog_posts"):
            SupportBlogPost.__table__.create(bind=engine)
    except Exception as e:
        print(f"[support] blog table check failed: {e}")


def _dict(p: SupportBlogPost) -> dict:
    return {
        "id": p.id, "topic": p.topic, "title": p.title, "slug": p.slug,
        "excerpt": p.excerpt, "seo_title": p.seo_title, "seo_description": p.seo_description,
        "body_markdown": p.body_markdown, "tags": p.tags or [], "status": p.status,
        "sanity_id": p.sanity_id, "published_url": p.published_url, "model_used": p.model_used,
        "created_by": p.created_by,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "published_at": p.published_at.isoformat() if p.published_at else None,
    }


class GenerateReq(BaseModel):
    topic: str
    keywords: Optional[str] = ""
    tone: Optional[str] = ""
    words: Optional[int] = 900


class UpdateReq(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    body_markdown: Optional[str] = None
    tags: Optional[List[str]] = None


@router.get("/config")
def config(_: object = Depends(get_current_admin)):
    """Surface which integrations are wired, so the UI can guide setup."""
    import os
    return {
        "claude_ready": bool(os.getenv("ANTHROPIC_API_KEY")),
        "sanity_ready": sanity_configured(),
    }


@router.post("/generate")
async def generate(req: GenerateReq, db: Session = Depends(get_db),
                   admin: object = Depends(get_current_admin)):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")
    _ensure_table()
    try:
        fields = await generate_blog_post(req.topic.strip(), req.keywords or "", req.tone or "", req.words or 900)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")

    post = SupportBlogPost(
        topic=req.topic.strip(), status="draft",
        created_by=getattr(admin, "email", None),
        **{k: fields[k] for k in ("title", "slug", "excerpt", "seo_title", "seo_description", "body_markdown", "tags", "model_used")},
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _dict(post)


@router.get("")
def list_posts(status: Optional[str] = None, db: Session = Depends(get_db),
               _: object = Depends(get_current_admin)):
    _ensure_table()
    q = db.query(SupportBlogPost)
    if status:
        q = q.filter(SupportBlogPost.status == status)
    rows = q.order_by(SupportBlogPost.created_at.desc()).limit(200).all()
    return [_dict(p) for p in rows]


@router.get("/{post_id}")
def get_post(post_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_admin)):
    p = db.query(SupportBlogPost).get(post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    return _dict(p)


@router.put("/{post_id}")
def update_post(post_id: int, req: UpdateReq, db: Session = Depends(get_db),
                _: object = Depends(get_current_admin)):
    p = db.query(SupportBlogPost).get(post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    if p.status == "published":
        raise HTTPException(status_code=400, detail="Published posts can't be edited here — edit in Sanity Studio")
    for field, value in req.dict(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return _dict(p)


@router.post("/{post_id}/publish")
async def publish_post(post_id: int, db: Session = Depends(get_db),
                       _: object = Depends(get_current_admin)):
    p = db.query(SupportBlogPost).get(post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    if p.status == "published":
        raise HTTPException(status_code=400, detail="Already published")
    if not sanity_configured():
        raise HTTPException(status_code=400, detail="Sanity isn't configured — set SANITY_PROJECT_ID / SANITY_DATASET / SANITY_TOKEN")
    if not (p.title and p.body_markdown):
        raise HTTPException(status_code=400, detail="Title and body are required before publishing")
    try:
        result = await publish_to_sanity(p)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Sanity publish failed: {e}")

    p.status = "published"
    p.sanity_id = result["sanity_id"]
    p.published_url = result["url"]
    p.published_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(p)
    # NOTE: Google Search Console URL submission is a follow-up step (needs a GSC
    # service account). The published_url is returned so it can be submitted.
    return _dict(p)


@router.delete("/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_admin)):
    p = db.query(SupportBlogPost).get(post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
