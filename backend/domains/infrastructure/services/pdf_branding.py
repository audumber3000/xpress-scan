"""Resolve a clinic's logo into something a PDF renderer can actually draw.

The problem this exists to solve: `template_configurations.logo_url` stores a
*presigned* R2 link (see the branding upload endpoint), and a presigned link
expires — seven days by default. The object is still there; the signature is
what dies. So every PDF rendered after that week asked R2 for the logo, got
`403 ExpiredRequest`, and quietly fell back to the clinic's initials. Nobody
noticed because a PDF with initials still looks deliberate.

Fetching by URL was always the wrong move. We hold the R2 credentials, so the
durable part of that stored link is the object key, and we can read the object
directly. That is what this module does: recover the key, pull the bytes with
our own credentials, and inline them as a `data:` URI.

Inlining rather than handing WeasyPrint a URL is the point:
  - it can't expire, so a logo uploaded today still renders in two years;
  - the renderer makes no outbound request at all, which closes the SSRF hole
    that fetching a DB-supplied URL at render time would otherwise open;
  - it's one round trip we control and cache, instead of one per PDF.
"""
import base64
import re
import threading
import time

_CACHE_TTL_SECONDS = 600
_MAX_LOGO_BYTES = 4 * 1024 * 1024

# A logo changes on the rare occasion someone re-uploads it, but PDFs render
# constantly, so the bytes are worth holding briefly. Guarded by a lock because
# several worker threads render at once.
_cache: dict[str, tuple[float, str]] = {}
_cache_lock = threading.Lock()

_DATA_URI_RE = re.compile(r'^data:image/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+$', re.I)

_CONTENT_TYPE_BY_SUFFIX = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
}


def _cache_get(key: str):
    with _cache_lock:
        hit = _cache.get(key)
        if not hit:
            return None
        stored_at, value = hit
        if time.time() - stored_at > _CACHE_TTL_SECONDS:
            _cache.pop(key, None)
            return None
        return value


def _cache_put(key: str, value: str) -> None:
    with _cache_lock:
        _cache[key] = (time.time(), value)


def _content_type_for(key: str) -> str:
    suffix = key.rsplit('.', 1)[-1].lower() if '.' in key else ''
    return _CONTENT_TYPE_BY_SUFFIX.get(suffix, 'image/png')


def _from_r2(candidate: str) -> str:
    """Read the object behind a stored R2 reference and inline it. '' on any
    miss — a missing logo must never be the reason a bill fails to render."""
    try:
        from domains.infrastructure.services.r2_storage import (
            download_bytes_from_r2, extract_r2_key,
        )

        key = extract_r2_key(candidate)
        if not key:
            return ''

        data = download_bytes_from_r2(key)
        if not data or len(data) > _MAX_LOGO_BYTES:
            return ''

        encoded = base64.b64encode(data).decode('ascii')
        return f'data:{_content_type_for(key)};base64,{encoded}'
    except Exception:
        return ''


def resolve_logo_data_uri(*candidates) -> str:
    """The first usable logo among `candidates`, as an inline `data:` URI.

    Pass them in preference order — typically the template config's logo first,
    then the clinic's own. A candidate that is already a data URI is taken as
    is; anything that looks like an R2 reference is read from the bucket with
    our credentials. Returns '' when nothing resolves, which is the caller's
    signal to fall back to initials.
    """
    for candidate in candidates:
        if not candidate or not isinstance(candidate, str):
            continue
        candidate = candidate.strip()
        if not candidate:
            continue

        # Already inline — the clinic-level logo is usually stored this way.
        if candidate.startswith('data:'):
            if _DATA_URI_RE.match(candidate):
                return candidate
            continue

        cached = _cache_get(candidate)
        if cached is not None:
            if cached:
                return cached
            continue

        resolved = _from_r2(candidate)
        # Negative results are cached too: when a clinic has no logo in R2, the
        # alternative is re-attempting a doomed fetch on every single PDF.
        _cache_put(candidate, resolved)
        if resolved:
            return resolved

    return ''
