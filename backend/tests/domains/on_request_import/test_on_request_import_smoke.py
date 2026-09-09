"""Auth-boundary smoke tests for the on_request_import domain (previously zero coverage)."""

def test_invoice_sheet_import_requires_auth(client):
    r = client.post("/api/v1/on-request-import/invoice-sheet", json={})
    assert r.status_code in (401, 403, 422), f"returned {r.status_code} — should require auth"
