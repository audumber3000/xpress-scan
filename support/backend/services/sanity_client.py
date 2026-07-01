"""Publish a reviewed blog draft to Sanity (which powers the marketing-site blog).

Config via env (set these on the support tool / Railway):
  SANITY_PROJECT_ID   - your Sanity project id
  SANITY_DATASET      - usually "production"
  SANITY_TOKEN        - an Editor/write token (sanity.io/manage → API → Tokens)
  SANITY_API_VERSION  - optional, default "2024-01-01"
  SANITY_BLOG_TYPE    - the document _type for a blog post (default "post")
  BLOG_PUBLIC_BASE    - public blog base URL for the returned link (default
                        "https://molarplus.com/blog")

NOTE: the exact field names below (title/slug/excerpt/body/seo/publishedAt) must
match your Sanity blog schema. They're the common defaults — confirm/adjust to
your schema. Body is sent BOTH as Portable Text ("body") and raw markdown
("bodyMarkdown") so either schema style works.
"""
import os
import re
import uuid
import datetime
import httpx


def sanity_configured() -> bool:
    return all(os.getenv(k) for k in ("SANITY_PROJECT_ID", "SANITY_DATASET", "SANITY_TOKEN"))


def _key() -> str:
    return uuid.uuid4().hex[:12]


def _markdown_to_portable_text(md: str) -> list:
    """Minimal Markdown → Portable Text: headings, bullet lists, paragraphs.
    Good enough for AI drafts; rich formatting can be tuned in Sanity Studio."""
    blocks = []
    for raw in (md or "").split("\n"):
        line = raw.rstrip()
        if not line.strip():
            continue
        style, text, list_item = "normal", line.strip(), False
        h = re.match(r"^(#{1,4})\s+(.*)$", line.strip())
        if h:
            style = {1: "h1", 2: "h2", 3: "h3", 4: "h4"}[len(h.group(1))]
            text = h.group(2).strip()
        elif re.match(r"^[-*]\s+", line.strip()):
            text = re.sub(r"^[-*]\s+", "", line.strip())
            list_item = True
        # strip inline markdown emphasis markers (kept plain for reliability)
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
        text = re.sub(r"\*(.*?)\*", r"\1", text)
        block = {
            "_type": "block", "_key": _key(), "style": "normal" if list_item else style,
            "markDefs": [],
            "children": [{"_type": "span", "_key": _key(), "text": text, "marks": []}],
        }
        if list_item:
            block["listItem"] = "bullet"
            block["level"] = 1
        blocks.append(block)
    return blocks


async def publish_to_sanity(post) -> dict:
    pid = os.getenv("SANITY_PROJECT_ID")
    dataset = os.getenv("SANITY_DATASET")
    token = os.getenv("SANITY_TOKEN")
    if not (pid and dataset and token):
        raise RuntimeError("Sanity is not configured (set SANITY_PROJECT_ID / SANITY_DATASET / SANITY_TOKEN)")

    api_version = os.getenv("SANITY_API_VERSION", "2024-01-01")
    doc_type = os.getenv("SANITY_BLOG_TYPE", "post")
    url = f"https://{pid}.api.sanity.io/v{api_version}/data/mutate/{dataset}"

    doc = {
        "_type": doc_type,
        "title": post.title,
        "slug": {"_type": "slug", "current": post.slug},
        "excerpt": post.excerpt or "",
        "seo": {
            "metaTitle": post.seo_title or post.title,
            "metaDescription": post.seo_description or post.excerpt or "",
        },
        "bodyMarkdown": post.body_markdown or "",
        "body": _markdown_to_portable_text(post.body_markdown or ""),
        "tags": post.tags or [],
        "publishedAt": datetime.datetime.utcnow().isoformat() + "Z",
    }
    payload = {"mutations": [{"create": doc}]}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        })
        resp.raise_for_status()
        data = resp.json()

    sanity_id = data["results"][0]["id"]
    base = os.getenv("BLOG_PUBLIC_BASE", "https://molarplus.com/blog").rstrip("/")
    return {"sanity_id": sanity_id, "url": f"{base}/{post.slug}"}
