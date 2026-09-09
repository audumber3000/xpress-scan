"""Auth-boundary smoke tests for the marketing domain (previously zero coverage).

Note the /website segment: website.py's router carries its own internal
prefix (`APIRouter(prefix="/website", ...)`) on top of the /api/v1/marketing
mount in main.py, so real paths are /api/v1/marketing/website/<route>.
"""
import pytest


@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/marketing/website/settings"),
    ("put", "/api/v1/marketing/website/settings"),
    ("get", "/api/v1/marketing/website/preview"),
    ("get", "/api/v1/marketing/website/photos"),
])
def test_owner_facing_endpoint_requires_auth(client, method, path):
    kwargs = {"json": {}} if method == "put" else {}
    r = getattr(client, method)(path, **kwargs)
    assert r.status_code in (401, 403), f"{method.upper()} {path} returned {r.status_code} — should require auth"


# The public clinic website is a link a PATIENT opens, not a signed-in user —
# same reasoning as consent links and review-redirect. If auth ever gets
# added here by accident, every clinic's public site breaks silently.
#
# Asserting != 401/403 alone isn't enough — a route that 404s because the
# path is simply wrong would pass that check too, without proving anything.
# Assert the specific "unknown clinic" 404 case reaches the route's own
# handler instead of a generic "no such route" 404.

def test_public_website_page_does_not_require_auth(client):
    r = client.get("/api/v1/marketing/website/public/some-clinic-slug-that-does-not-exist")
    assert r.status_code not in (401, 403)
    assert r.status_code == 404
    assert r.json().get("detail") != "Not Found", (
        "Got FastAPI's generic 'no matching route' 404, not the handler's "
        "own 'unknown clinic' response — the path is wrong, not exercising "
        "the route at all."
    )


def test_og_image_does_not_require_auth(client):
    r = client.get("/api/v1/marketing/website/og-image/some-clinic-slug-that-does-not-exist")
    assert r.status_code not in (401, 403)
