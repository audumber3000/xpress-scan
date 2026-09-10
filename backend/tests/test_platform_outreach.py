"""ClinoHealth saying hello to a new signup, from our own number.

Three WhatsApp paths exist and only one of them is this: MSG91 (clinic ->
patient, billed), WA Reach (clinic -> patient from the clinic's own number),
and this (ClinoHealth -> clinic owner, from ours). These tests are mostly about
keeping them apart, and about the outreach never being able to break a signup.

Nothing here touches the network: send_text is patched, and the module is a
no-op unless both env vars are set — which they are not under pytest.
"""
import pytest

from integration import outreach


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(outreach, "OUTREACH_URL", "http://gateway.test")
    monkeypatch.setattr(outreach, "OUTREACH_KEY", "wr_test")
    monkeypatch.setattr(outreach, "OUTREACH_DISABLED", False)


@pytest.fixture
def captured(monkeypatch, configured):
    sent = []
    monkeypatch.setattr(outreach, "send_text",
                        lambda to, text: (sent.append((to, text)) or (True, "sent")))
    return sent


# ── off unless configured ────────────────────────────────────────────────────

def test_it_is_off_by_default(monkeypatch):
    """A developer running locally must not be able to message a real dentist,
    so there is no default URL and no default key."""
    monkeypatch.setattr(outreach, "OUTREACH_URL", "")
    monkeypatch.setattr(outreach, "OUTREACH_KEY", "")
    assert outreach.is_configured() is False
    assert outreach.send_text("919876543210", "hello")[0] is False


def test_half_configured_is_still_off(monkeypatch):
    monkeypatch.setattr(outreach, "OUTREACH_URL", "http://gateway.test")
    monkeypatch.setattr(outreach, "OUTREACH_KEY", "")
    assert outreach.is_configured() is False


def test_it_can_be_switched_off_without_removing_credentials(monkeypatch, configured):
    monkeypatch.setattr(outreach, "OUTREACH_DISABLED", True)
    assert outreach.is_configured() is False


# ── the message ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("full,expected", [
    ("Dr. Rajesh Sharma", "Rajesh"),
    ("doctor Priya Nair", "Priya"),
    ("Mr Anand", "Anand"),
    ("Priya", "Priya"),
    ("", ""),
    (None, ""),
])
def test_titles_are_stripped_before_the_greeting_adds_one_back(full, expected):
    """"Hi Dr Dr Sharma" is how a bot introduces itself."""
    assert outreach._first_name(full) == expected


def test_the_greeting_names_the_person_the_clinic_and_the_agent(monkeypatch):
    monkeypatch.setattr(outreach, "OUTREACH_AGENT", "Rohit")
    msg = outreach.signup_greeting("Dr. Rajesh Sharma", "Sharma Dental Clinic")
    assert "Hi Dr Rajesh," in msg
    assert "Rohit" in msg
    assert "Sharma Dental Clinic" in msg
    assert "Dr Dr" not in msg
    # The specific offer, not just "reach out anytime".
    assert "live demo" in msg


def test_the_greeting_avoids_dashes_that_read_as_machine_written():
    """House rule: no em or en dashes in anything a customer reads."""
    msg = outreach.signup_greeting("Dr. Rajesh Sharma", "Sharma Dental Clinic")
    assert "\u2014" not in msg and "\u2013" not in msg


def test_the_greeting_still_works_with_nothing_on_file():
    msg = outreach.signup_greeting(None, None)
    assert msg.startswith("Hi Doctor,")
    assert "None" not in msg


# ── sending ──────────────────────────────────────────────────────────────────

def test_an_unusable_number_is_refused_before_the_network(configured):
    assert outreach.send_text("", "hi")[0] is False
    assert outreach.send_text("12", "hi")[0] is False


def test_the_number_is_normalised_to_the_gateways_format(monkeypatch, configured):
    """The gateway wants country code + digits, no plus."""
    seen = {}

    class _Resp:
        status_code = 200

    def fake_post(url, headers=None, json=None, timeout=None):
        seen.update(url=url, headers=headers, json=json)
        return _Resp()

    monkeypatch.setattr(outreach.httpx, "post", fake_post)
    ok, _ = outreach.send_text("07798121777", "hello")
    assert ok is True
    assert seen["json"]["to"] == "917798121777"
    assert seen["url"] == "http://gateway.test/api/v1/messages"
    assert seen["headers"]["Authorization"] == "Bearer wr_test"


def test_a_gateway_failure_never_raises(monkeypatch, configured):
    def boom(*a, **k):
        raise RuntimeError("connection reset")

    monkeypatch.setattr(outreach.httpx, "post", boom)
    ok, detail = outreach.send_text("919876543210", "hello")
    assert ok is False
    assert detail == "RuntimeError"


def test_a_rejection_is_reported_not_raised(monkeypatch, configured):
    class _Resp:
        status_code = 502

    monkeypatch.setattr(outreach.httpx, "post", lambda *a, **k: _Resp())
    ok, detail = outreach.send_text("919876543210", "hello")
    assert ok is False
    assert "502" in detail


# ── the signup hook ──────────────────────────────────────────────────────────

def test_a_new_signup_is_greeted_once(db_session, test_clinic, test_user, captured):
    test_clinic.phone = "7798121777"
    db_session.commit()

    assert outreach.greet_new_signup(db_session, test_clinic, test_user) is True
    assert len(captured) == 1

    # Onboarding can be completed twice — a retried request, an owner revisiting
    # the wizard. "I saw you just signed up" arriving twice reads worse than not
    # arriving at all.
    assert outreach.greet_new_signup(db_session, test_clinic, test_user) is False
    assert len(captured) == 1


def test_a_clinic_with_no_number_is_skipped(db_session, test_clinic, test_user, captured):
    test_clinic.phone = None
    test_user.phone = None
    db_session.commit()
    assert outreach.greet_new_signup(db_session, test_clinic, test_user) is False
    assert captured == []


def test_the_send_is_logged_at_zero_cost_under_its_own_provider(
    db_session, test_clinic, test_user, captured
):
    """It is ClinoHealth's message on ClinoHealth's number. Billing it to the
    clinic's wallet would charge them for being sold to."""
    from models import NotificationLog

    test_clinic.phone = "7798121777"
    db_session.commit()
    outreach.greet_new_signup(db_session, test_clinic, test_user)

    row = db_session.query(NotificationLog).filter(
        NotificationLog.event_type == "platform_signup_hello"
    ).one()
    assert row.cost == 0.0
    assert row.provider == "platform_wa"
    assert row.status == "sent"
    assert row.clinic_id == test_clinic.id


def test_a_failed_send_is_recorded_as_failed(
    monkeypatch, db_session, test_clinic, test_user, configured
):
    from models import NotificationLog

    monkeypatch.setattr(outreach, "send_text", lambda to, text: (False, "HTTP 502"))
    test_clinic.phone = "7798121777"
    db_session.commit()

    assert outreach.greet_new_signup(db_session, test_clinic, test_user) is False
    row = db_session.query(NotificationLog).filter(
        NotificationLog.event_type == "platform_signup_hello"
    ).one()
    assert row.status == "failed"
    assert row.error_message == "HTTP 502"


def test_it_shares_nothing_with_the_clinic_messaging_paths():
    """A change to how clinics message patients must not be able to change how
    we introduce ourselves, and vice versa.

    Checks the imports, not the prose. The module docstring names all three
    paths on purpose, because the whole point of the file is explaining which
    of them this is."""
    import ast
    import inspect

    tree = ast.parse(inspect.getsource(outreach))
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)
        elif isinstance(node, ast.Import):
            imported.update(a.name for a in node.names)

    forbidden = ("notification_dispatch", "wareach", "nexus_notify", "msg91")
    leaked = [m for m in imported for f in forbidden if f in m.lower()]
    assert not leaked, f"outreach imports a clinic messaging path: {leaked}"
