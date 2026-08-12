"""
Clinic website: settings, photos, and the live preview the editor renders.

Public serving is deliberately NOT here yet. Everything in this module requires
a signed-in user, so a clinic can build and preview a site before anything is
reachable from outside. The public route is a separate, later piece with its own
rate limiting and its own hard rule about what it may read.
"""
import logging
import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import (Clinic, ClinicPhoto, GooglePlaceLink, GoogleReview, Patient,
                    TreatmentType, User)
from domains.infrastructure.services.r2_storage import (
    StorageCategory, delete_file_from_r2, get_presigned_url, upload_bytes_to_r2,
)
from domains.marketing.website_renderer import render_site, slugify
from core.roles import CLINICAL_ROLES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/website", tags=["website"])

MAX_PHOTOS = 12
MAX_PHOTO_MB = 8


class WebsiteSettings(BaseModel):
    website_slug: Optional[str] = None
    website_enabled: Optional[bool] = None
    website_about: Optional[str] = None
    website_show_stats: Optional[bool] = None
    tagline: Optional[str] = None
    primary_color: Optional[str] = None


def _band(n: int) -> str:
    """A patient count as a band, never the live figure.

    The exact number is a real clinical count that competitors can read and that
    moves on every sync. "500+" says the same useful thing and gives nothing away.
    """
    for floor in (5000, 2000, 1000, 500, 200, 100, 50):
        if n >= floor:
            return f"{floor:,}+"
    return str(n) if n else ""


def build_context(db: Session, clinic: Clinic) -> dict:
    """Everything the renderer needs, assembled from setup data.

    Nothing here is website-specific content: it is the same rows the app runs
    on, which is why the site cannot drift out of date.
    """
    cid = clinic.id

    treatments = (
        db.query(TreatmentType)
        .filter(TreatmentType.clinic_id == cid, TreatmentType.is_active == True)  # noqa: E712
        .order_by(TreatmentType.price.desc())
        .all()
    )

    link = db.query(GooglePlaceLink).filter(GooglePlaceLink.clinic_id == cid).first()
    reviews = []
    if link:
        reviews = (
            db.query(GoogleReview)
            .filter(GoogleReview.clinic_id == cid, GoogleReview.rating >= 4,
                    GoogleReview.text.isnot(None))
            .order_by(GoogleReview.review_time.desc())
            .limit(6)
            .all()
        )

    dentists = (
        db.query(User)
        .filter(User.clinic_id == cid, User.role.in_(CLINICAL_ROLES),
                User.is_active == True)  # noqa: E712
        .all()
    )

    photos = (
        db.query(ClinicPhoto)
        .filter(ClinicPhoto.clinic_id == cid)
        .order_by(ClinicPhoto.sort_order, ClinicPhoto.id)
        .all()
    )

    patient_count = db.query(func.count(Patient.id)).filter(Patient.clinic_id == cid).scalar() or 0
    years = max(1, datetime.utcnow().year - (clinic.created_at.year if clinic.created_at else datetime.utcnow().year))

    stats = {}
    if clinic.website_show_stats:
        stats = {
            "Patients treated": _band(patient_count),
            "Google reviews": f"{link.total_review_count:,}" if link and link.total_review_count else "",
            "Years of care": str(years) if years > 1 else "",
        }

    # Locality from the tail of the address, purely for the hero eyebrow.
    locality = ""
    if clinic.address:
        parts = [p.strip() for p in str(clinic.address).split(",") if p.strip()]
        if parts:
            locality = re.sub(r"\d{5,}", "", parts[-1]).strip() or (parts[-2] if len(parts) > 1 else "")

    return {
        "clinic": {
            "name": clinic.name, "tagline": clinic.tagline, "phone": clinic.phone,
            "address": clinic.address, "logo_url": clinic.logo_url,
            "primary_color": clinic.primary_color, "timings": clinic.timings,
            "currency_symbol": clinic.currency_symbol, "license_number": clinic.license_number,
            "website_about": clinic.website_about, "website_show_stats": clinic.website_show_stats,
            "locality": locality,
        },
        "treatments": [{"name": t.name, "price": t.price} for t in treatments],
        "reviews": [{"author_name": r.author_name, "rating": r.rating, "text": r.text} for r in reviews],
        "dentists": [{"name": d.name, "qualification": None} for d in dentists],
        "photos": [{"url": get_presigned_url(p.file_path) or "", "caption": p.caption} for p in photos],
        "rating": float(link.current_rating) if link and link.current_rating else None,
        "review_count": link.total_review_count if link else 0,
        "stats": stats,
        # Where this page will live, for canonical and structured data.
        "site_url": f"https://app.molarplus.com/c/{clinic.website_slug or slugify(clinic.name or '')}",
        # The public booking page the app already publishes. Without this the
        # only way to act on the site was to compose a WhatsApp message.
        "booking_url": f"https://app.molarplus.com/book/{clinic.id}",
        # Stable, unsigned: an expiring URL in an og:image breaks every share
        # a few hours after it is posted.
        "og_image_url": (
            f"https://api.molarplus.com/api/v1/marketing/website/og-image/"
            f"{clinic.website_slug or slugify(clinic.name or '')}"
        ),
    }


def readiness(db: Session, clinic: Clinic, ctx: dict) -> List[dict]:
    """What still needs filling in before the site is worth publishing.

    Ordered by how much each one changes the page a patient sees.
    """
    return [
        {"key": "name", "label": "Clinic name", "done": bool(clinic.name), "required": True},
        {"key": "phone", "label": "Phone number", "done": bool(clinic.phone), "required": True,
         "hint": "Powers the call and WhatsApp buttons"},
        {"key": "address", "label": "Address", "done": bool(clinic.address), "required": True,
         "hint": "Shown in the footer and links to Maps"},
        {"key": "tagline", "label": "One-line description", "done": bool(clinic.tagline),
         "hint": "The sentence under your name"},
        {"key": "logo", "label": "Logo", "done": bool(clinic.logo_url)},
        {"key": "treatments", "label": "Treatments with prices", "done": len(ctx["treatments"]) > 0,
         "hint": "From Control Center, Treatments and Pricing"},
        {"key": "photos", "label": "Clinic photos", "done": len(ctx["photos"]) > 0,
         "hint": "Add these in Control Center, Clinic Info"},
        {"key": "google", "label": "Google reviews linked", "done": ctx["rating"] is not None,
         "hint": "Link your listing under Marketing, Google Reviews"},
        {"key": "hours", "label": "Opening hours", "done": bool(clinic.timings)},
    ]


def _clinic(db: Session, current_user: User) -> Clinic:
    c = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return c


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    clinic = _clinic(db, current_user)
    ctx = build_context(db, clinic)
    checks = readiness(db, clinic, ctx)
    return {
        "slug": clinic.website_slug or slugify(clinic.name or ""),
        "enabled": bool(clinic.website_enabled),
        "published_at": clinic.website_published_at.isoformat() if clinic.website_published_at else None,
        "about": clinic.website_about,
        "show_stats": bool(clinic.website_show_stats),
        "tagline": clinic.tagline,
        "primary_color": clinic.primary_color,
        "readiness": checks,
        "ready_count": sum(1 for c in checks if c["done"]),
        "total_count": len(checks),
        "blockers": [c["label"] for c in checks if c.get("required") and not c["done"]],
        "photo_count": len(ctx["photos"]),
    }


@router.put("/settings")
def update_settings(
    payload: WebsiteSettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clinic = _clinic(db, current_user)

    if payload.website_slug is not None:
        slug = slugify(payload.website_slug)
        if not slug:
            raise HTTPException(status_code=400, detail="That address cannot be used")
        clash = db.query(Clinic).filter(
            Clinic.website_slug == slug, Clinic.id != clinic.id
        ).first()
        if clash:
            raise HTTPException(status_code=400, detail="That web address is already taken")
        clinic.website_slug = slug

    if payload.website_enabled is not None:
        # Publishing is blocked until the page would actually be usable: no
        # phone means no way to contact the clinic that found you.
        if payload.website_enabled:
            ctx = build_context(db, clinic)
            blockers = [c["label"] for c in readiness(db, clinic, ctx) if c.get("required") and not c["done"]]
            if blockers:
                raise HTTPException(status_code=400, detail=f"Add these first: {', '.join(blockers)}")
            if not clinic.website_slug:
                clinic.website_slug = slugify(clinic.name or "")
            clinic.website_published_at = datetime.utcnow()
        clinic.website_enabled = payload.website_enabled

    for field in ("website_about", "website_show_stats", "tagline", "primary_color"):
        val = getattr(payload, field)
        if val is not None:
            setattr(clinic, field, val)

    db.commit()
    return get_settings(db=db, current_user=current_user)


@router.get("/og-image/{slug}")
def og_image(slug: str, db: Session = Depends(get_db)):
    """A stable share image for a clinic's site.

    The Open Graph tag cannot point at a presigned R2 URL: those expire, so
    every WhatsApp and Facebook share would render a broken image a few hours
    after it was posted, which is precisely the failure the tag exists to
    prevent. This URL never changes and redirects to a freshly signed one on
    each request.

    Public on purpose. It resolves a published clinic's first photo and
    nothing else, which is already visible to anyone who opens the site.
    """
    clinic = db.query(Clinic).filter(
        Clinic.website_slug == slug, Clinic.website_enabled == True  # noqa: E712
    ).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Not found")

    photo = (
        db.query(ClinicPhoto)
        .filter(ClinicPhoto.clinic_id == clinic.id)
        .order_by(ClinicPhoto.sort_order, ClinicPhoto.id)
        .first()
    )
    target = get_presigned_url(photo.file_path) if photo else (clinic.logo_url or "")
    if not target:
        raise HTTPException(status_code=404, detail="No image")
    return RedirectResponse(url=target, status_code=302)


@router.get("/preview", response_class=Response)
def preview(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The site as it stands, for the editor's iframe. Same renderer as public."""
    clinic = _clinic(db, current_user)
    html = render_site(build_context(db, clinic))
    return Response(content=html, media_type="text/html")


# ─── Photos ──────────────────────────────────────────────────────────────────

@router.get("/photos")
def list_photos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(ClinicPhoto)
        .filter(ClinicPhoto.clinic_id == current_user.clinic_id)
        .order_by(ClinicPhoto.sort_order, ClinicPhoto.id)
        .all()
    )
    return [{
        "id": p.id,
        "url": get_presigned_url(p.file_path) or "",
        "caption": p.caption,
        "sort_order": p.sort_order,
    } for p in rows]


@router.post("/photos")
async def upload_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = current_user.clinic_id
    count = db.query(func.count(ClinicPhoto.id)).filter(ClinicPhoto.clinic_id == cid).scalar() or 0
    if count >= MAX_PHOTOS:
        raise HTTPException(status_code=400, detail=f"You can add up to {MAX_PHOTOS} photos")

    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="That file is not an image")

    data = await file.read()
    if len(data) > MAX_PHOTO_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Images must be under {MAX_PHOTO_MB} MB")

    key = upload_bytes_to_r2(
        data=data, filename=file.filename, content_type=file.content_type,
        clinic_id=cid, category=StorageCategory.BRANDING,
    )
    if not key:
        raise HTTPException(status_code=503, detail="Could not store that image")

    photo = ClinicPhoto(
        clinic_id=cid, file_path=key, sort_order=count,
        uploaded_by=current_user.id,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return {"id": photo.id, "url": get_presigned_url(photo.file_path) or "",
            "caption": photo.caption, "sort_order": photo.sort_order}


@router.delete("/photos/{photo_id}")
def delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    photo = db.query(ClinicPhoto).filter(
        ClinicPhoto.id == photo_id, ClinicPhoto.clinic_id == current_user.clinic_id
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    path = photo.file_path
    db.delete(photo)
    db.commit()
    # Best effort: a storage hiccup must not leave the row undeletable.
    try:
        delete_file_from_r2(path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("R2 cleanup failed for clinic photo %s: %s", photo_id, exc)
    return {"message": "Photo removed"}
