"""Sanitisers for user-controlled values that get interpolated into PDF HTML/CSS.

Defence-in-depth on top of DTO validation: existing rows in the DB may pre-date
the validation, so the renderer must not trust stored values blindly.
"""
import html
import re
from urllib.parse import urlparse

_HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
_PRIVATE_HOST_PREFIXES = ("localhost", "127.", "169.254.", "10.", "192.168.", "0.")


def safe_color(value, default: str = "#1a2a6c") -> str:
    """Return value if it's a valid hex color, else default. Safe to inject into CSS."""
    if value and isinstance(value, str) and _HEX_RE.match(value):
        return value
    return default


def safe_text(value) -> str:
    """HTML-escape a user string. Quotes escaped so the result is safe inside attributes too."""
    if value is None:
        return ""
    return html.escape(str(value), quote=True)


def safe_signature_data_uri(value) -> str:
    """Return a data: URI verbatim if it's a `data:image/(png|jpeg);base64,...`
    string we trust, else ''. Sanity-checked at render time as defence-in-depth
    against a poisoned DB row — the upload endpoint already validates on save.
    Note: SVG is rejected; WeasyPrint executes SVG scripts in some configs."""
    if not value or not isinstance(value, str):
        return ""
    if not value.startswith("data:"):
        return ""
    head_lower = value[:60].lower()
    if "svg" in head_lower:
        return ""
    if not (value.startswith("data:image/png;base64,") or value.startswith("data:image/jpeg;base64,") or value.startswith("data:image/jpg;base64,")):
        return ""
    # Cap at ~1.5 MB rendered length so a malformed long URI can't slow render.
    if len(value) > 1_500_000:
        return ""
    return value


def safe_url(value) -> str:
    """Return value if it's an https URL pointing at a public host, else ''.
    Used for logo_url etc. that WeasyPrint will fetch server-side."""
    if not value or not isinstance(value, str):
        return ""
    try:
        parsed = urlparse(value)
    except Exception:
        return ""
    if parsed.scheme != "https" or not parsed.netloc:
        return ""
    host = parsed.netloc.lower()
    if any(host.startswith(p) for p in _PRIVATE_HOST_PREFIXES):
        return ""
    if len(value) > 2048:
        return ""
    return value
