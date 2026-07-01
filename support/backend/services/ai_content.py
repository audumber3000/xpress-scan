"""Claude-backed content generation for the AI Blog Studio.

Calls the Anthropic Messages API directly over httpx — no extra dependency (the
support backend already ships httpx). Requires ANTHROPIC_API_KEY in the env.
"""
import os
import re
import json
import httpx

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

BLOG_SYSTEM = (
    "You are a senior content marketer for MolarPlus — dental clinic management "
    "software (patient records, appointments, billing/invoicing, WhatsApp reminders, "
    "consent forms, multi-branch, reports). Your readers are dentists and clinic "
    "owners, primarily in India. Write genuinely helpful, SEO-friendly posts — "
    "practical and specific, not salesy. A soft, relevant CTA at the very end is fine. "
    "Return ONLY a single valid JSON object and nothing else."
)


def _prompt(topic: str, keywords: str, tone: str, words: int) -> str:
    kw = f'Target SEO keywords to work in naturally: {keywords}.\n' if keywords else ''
    return (
        f'Write a blog post about: "{topic}".\n{kw}'
        f'Tone: {tone or "professional, friendly, clear"}. Target length: ~{words or 900} words.\n\n'
        'Return a JSON object with EXACTLY these fields:\n'
        '- "title": string, catchy, <= 65 chars\n'
        '- "slug": string, url-safe kebab-case\n'
        '- "excerpt": string, 1-2 sentence summary, <= 160 chars\n'
        '- "seo_title": string, <= 60 chars\n'
        '- "seo_description": string, meta description, <= 155 chars\n'
        '- "body_markdown": string, the full post in Markdown (## subheadings, short '
        'paragraphs, bullet lists where useful; do NOT include the H1 title)\n'
        '- "tags": array of 3-6 short lowercase tag strings\n'
    )


async def generate_blog_post(topic: str, keywords: str = "", tone: str = "",
                             words: int = 900, model: str | None = None) -> dict:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set on the support backend")

    used_model = model or DEFAULT_MODEL
    payload = {
        "model": used_model,
        "max_tokens": 4096,
        "system": BLOG_SYSTEM,
        "messages": [{"role": "user", "content": _prompt(topic, keywords, tone, words)}],
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(ANTHROPIC_URL, json=payload, headers={
            "x-api-key": api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        })
        resp.raise_for_status()
        data = resp.json()

    text = "".join(
        block.get("text", "") for block in data.get("content", [])
        if block.get("type") == "text"
    )
    fields = _parse(text)
    fields["model_used"] = used_model
    return fields


def _slugify(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80] or "post"


def _parse(text: str) -> dict:
    """Extract the JSON object Claude returned (tolerates ```json fences / stray prose)."""
    text = (text or "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    raw = match.group(0) if match else text
    obj = json.loads(raw)  # let a genuine parse error surface to the caller
    title = (obj.get("title") or "").strip()
    return {
        "title": title,
        "slug": _slugify(obj.get("slug") or title),
        "excerpt": (obj.get("excerpt") or "").strip(),
        "seo_title": (obj.get("seo_title") or title).strip()[:60],
        "seo_description": (obj.get("seo_description") or obj.get("excerpt") or "").strip()[:160],
        "body_markdown": (obj.get("body_markdown") or "").strip(),
        "tags": [str(t).lower().strip() for t in (obj.get("tags") or []) if str(t).strip()][:6],
    }
