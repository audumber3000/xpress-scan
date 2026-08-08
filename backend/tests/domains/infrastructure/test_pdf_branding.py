"""Logo resolution for PDF templates.

The bug this guards against shipped silently and stayed broken for months: the
branding upload endpoint stores a *presigned* R2 URL, presigned URLs expire in
seven days, and every PDF rendered after that got `403 ExpiredRequest` and fell
back to the clinic's initials. A PDF with initials looks intentional, so nothing
ever alerted.

The rule these tests pin down: never render a logo by fetching a stored URL.
Recover the object key, read it with our own credentials, inline the bytes.
"""
from __future__ import annotations

import base64

import pytest

from domains.infrastructure.services import pdf_branding
from domains.infrastructure.services.pdf_branding import resolve_logo_data_uri

PNG_BYTES = base64.b64decode(
    b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
EXPIRED_PRESIGNED = (
    "https://acct.r2.cloudflarestorage.com/my-bucket/clinics/2/branding/invoice_logo_1777365670.png"
    "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=abc%2F20260428%2Fauto%2Fs3%2Faws4_request"
    "&X-Amz-Date=20260428T084111Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=dead"
)


@pytest.fixture(autouse=True)
def _clear_cache():
    pdf_branding._cache.clear()
    yield
    pdf_branding._cache.clear()


@pytest.fixture
def r2(monkeypatch):
    """Stand in for the bucket, recording which keys were asked for. Key
    extraction stays real — it is half of what these tests are checking."""
    monkeypatch.setenv("R2_BUCKET_NAME", "my-bucket")
    monkeypatch.delenv("R2_PUBLIC_URL", raising=False)

    calls = []

    def fake_download(key):
        calls.append(key)
        return PNG_BYTES if key.startswith("clinics/") else None

    monkeypatch.setattr(
        "domains.infrastructure.services.r2_storage.download_bytes_from_r2", fake_download
    )
    return calls


def test_expired_presigned_url_still_resolves_the_logo(r2):
    """The whole point. The signature is dead; the object is not."""
    resolved = resolve_logo_data_uri(EXPIRED_PRESIGNED, None)

    assert resolved.startswith("data:image/png;base64,")
    assert base64.b64decode(resolved.split(",", 1)[1]) == PNG_BYTES
    # Read by key with our credentials, never by fetching the dead URL.
    assert r2 == ["clinics/2/branding/invoice_logo_1777365670.png"]


def test_result_is_inline_so_the_renderer_makes_no_outbound_request(r2):
    """Handing WeasyPrint a DB-supplied URL to fetch is an SSRF hole. Inlining
    closes it: whatever is stored, what reaches the renderer is bytes."""
    resolved = resolve_logo_data_uri(EXPIRED_PRESIGNED, None)

    assert "://" not in resolved
    assert resolved.startswith("data:")


def test_falls_through_to_the_clinic_logo_when_the_config_one_is_gone(r2):
    """A config pointing at a deleted object must not mean 'no logo' when the
    clinic has a perfectly good one of its own."""
    missing = "https://acct.r2.cloudflarestorage.com/my-bucket/gone/nothing.png"
    clinic_logo = "data:image/png;base64," + base64.b64encode(PNG_BYTES).decode()

    assert resolve_logo_data_uri(missing, clinic_logo) == clinic_logo


def test_data_uri_candidate_is_used_as_is(r2):
    """Clinic-level logos are stored inline already — don't touch the bucket."""
    clinic_logo = "data:image/png;base64," + base64.b64encode(PNG_BYTES).decode()

    assert resolve_logo_data_uri(clinic_logo) == clinic_logo
    assert r2 == []


def test_no_logo_anywhere_returns_empty_so_callers_show_initials(r2):
    assert resolve_logo_data_uri(None, None, "", "   ") == ""


def test_a_poisoned_data_uri_is_rejected(r2):
    """`data:` is not automatically safe — only real base64 image payloads pass,
    so a stored `data:text/html,<script>` can't ride into the document."""
    assert resolve_logo_data_uri("data:text/html;base64,PHNjcmlwdD4=") == ""
    assert resolve_logo_data_uri("data:image/svg+xml,<svg onload=alert(1)>") == ""


def test_oversized_objects_are_refused(r2, monkeypatch):
    """A runaway image would bloat every PDF it appears on."""
    monkeypatch.setattr(
        "domains.infrastructure.services.r2_storage.download_bytes_from_r2",
        lambda key: b"x" * (pdf_branding._MAX_LOGO_BYTES + 1),
    )
    assert resolve_logo_data_uri(EXPIRED_PRESIGNED) == ""


def test_storage_failure_never_breaks_the_document(r2, monkeypatch):
    """A bill has to render even when the bucket is unreachable."""
    def boom(key):
        raise RuntimeError("R2 down")

    monkeypatch.setattr(
        "domains.infrastructure.services.r2_storage.download_bytes_from_r2", boom
    )
    assert resolve_logo_data_uri(EXPIRED_PRESIGNED) == ""


def test_repeat_renders_hit_the_cache_not_the_bucket(r2):
    """PDFs render constantly and logos change almost never."""
    first = resolve_logo_data_uri(EXPIRED_PRESIGNED)
    second = resolve_logo_data_uri(EXPIRED_PRESIGNED)

    assert first == second
    assert len(r2) == 1, "second render should not re-download"


def test_a_missing_logo_is_not_retried_on_every_render(r2):
    missing = "https://acct.r2.cloudflarestorage.com/my-bucket/gone/nothing.png"

    resolve_logo_data_uri(missing)
    resolve_logo_data_uri(missing)

    assert len(r2) == 1, "a known-missing logo should not be re-fetched per PDF"


# ── Key extraction ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("stored,expected", [
    # Presigned URL — the signature is on the query string, not the path.
    (EXPIRED_PRESIGNED, "clinics/2/branding/invoice_logo_1777365670.png"),
    # Plain API URL.
    ("https://acct.r2.cloudflarestorage.com/my-bucket/clinics/9/branding/a.png",
     "clinics/9/branding/a.png"),
    # Bare key, already relative.
    ("clinics/9/branding/a.png", "clinics/9/branding/a.png"),
    # Legacy value with the bucket baked into the key.
    ("my-bucket/clinics/9/branding/a.png", "clinics/9/branding/a.png"),
    # Percent-encoded path.
    ("https://acct.r2.cloudflarestorage.com/my-bucket/clinics/9/branding/my%20logo.png",
     "clinics/9/branding/my logo.png"),
])
def test_extract_r2_key(stored, expected, monkeypatch):
    monkeypatch.setenv("R2_BUCKET_NAME", "my-bucket")
    monkeypatch.delenv("R2_PUBLIC_URL", raising=False)
    from domains.infrastructure.services.r2_storage import extract_r2_key

    assert extract_r2_key(stored) == expected


@pytest.mark.parametrize("stored", [None, "", "https://example.com/logo.png"])
def test_extract_r2_key_rejects_non_r2_values(stored, monkeypatch):
    """A URL on somebody else's host is not ours to read, and must not be
    mistaken for a key that we then look up in our own bucket."""
    monkeypatch.setenv("R2_BUCKET_NAME", "my-bucket")
    monkeypatch.delenv("R2_PUBLIC_URL", raising=False)
    from domains.infrastructure.services.r2_storage import extract_r2_key

    assert extract_r2_key(stored) is None
