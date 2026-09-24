"""POST /consents/links: the backend builds the nexus request, not the browser."""
import httpx
import pytest


class _FakeResp:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body

    def json(self):
        return self._body


@pytest.fixture
def nexus(monkeypatch):
    calls = []

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, json=None):
            calls.append((url, json))
            return _FakeResp(200, {"token": "tok123", "signUrl": "/consent/sign/tok123", "expires_in": 300})

    monkeypatch.setattr(httpx, "AsyncClient", _Client)
    return calls


def _template(client, auth_headers):
    return client.post("/api/v1/consents/templates",
                       json={"name": "Link test", "content": "Wording."}, headers=auth_headers).json()


def test_link_uses_stored_wording_and_tolerates_missing_phone(client, auth_headers, test_patient, db_session, nexus):
    test_patient.phone = ""  # NOT NULL in the schema; blank is the real "no phone"
    db_session.commit()
    t = _template(client, auth_headers)

    r = client.post("/api/v1/consents/links",
                    json={"template_id": t["id"], "patient_id": test_patient.id}, headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token"] == "tok123"
    assert body["sign_url"] == "/consent/sign/tok123"
    assert body["patient"]["phone"] == ""

    url, sent = nexus[0]
    assert url.endswith("/api/v1/consent/generate")
    assert sent["content"] == "Wording."
    assert sent["phone"] == ""
    assert sent["templateId"] == t["id"]


def test_link_rejects_unknown_template_and_patient(client, auth_headers, test_patient, nexus):
    t = _template(client, auth_headers)
    assert client.post("/api/v1/consents/links", json={"template_id": 999999, "patient_id": test_patient.id},
                       headers=auth_headers).status_code == 404
    assert client.post("/api/v1/consents/links", json={"template_id": t["id"], "patient_id": 999999},
                       headers=auth_headers).status_code == 404
    assert nexus == []


def test_link_requires_auth(client):
    assert client.post("/api/v1/consents/links", json={"template_id": 1, "patient_id": 1}).status_code in (401, 403)
