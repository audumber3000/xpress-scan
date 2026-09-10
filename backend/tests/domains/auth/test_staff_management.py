"""Adding and managing staff — the flow clinics were complaining about.

Three separate faults are pinned here, all found by reading the routes.

1. **Nobody but the owner could manage staff at all.** The permission grid
   writes the module as `staff` with the action `read`; every route in
   clinic_users.py, users.py and devices.py asked for `users`/`view`, a key no
   preset has ever written. An owner could tick Staff/Admin for their manager
   and the manager still got "You don't have permission to view staff
   management". Exactly the billing/finance bug in
   test_permission_resource_aliases.py, in a second place.

2. **Two privilege-escalation holes on `role`.** It was an unvalidated free
   string, and core.roles.assignable_by was only ever used to fill the dropdown.
   A non-owner with staff-edit could create a clinic_owner, and could raise
   their OWN role to clinic_owner — which bypasses every permission check in the
   application.

3. **Accounts that could not be signed into.** The password was optional and the
   invitation went out with an empty one.
"""
import pytest

from domains.auth.services.auth_service import AuthService
from models import User


def _hash(raw: str) -> str:
    return AuthService(None, None, None)._hash_password(raw)


def _token(user_id: int) -> dict:
    return {"Authorization": f"Bearer {AuthService(None, None, None).create_jwt_token(user_id)}"}


@pytest.fixture
def manager(db_session, test_clinic):
    """A receptionist the owner has granted full Staff/Admin access.

    Granted the way the UI grants it — module `staff`, actions read/write/edit
    /delete — which is the whole point: this is the shape that used to be
    ignored.
    """
    user = User(
        clinic_id=test_clinic.id,
        email="manager@clinic.com",
        first_name="Mira", last_name="Manager", name="Mira Manager",
        role="receptionist",
        is_active=True,
        password_hash=_hash("managerpass1"),
        permissions={
            "staff": {"read": True, "write": True, "edit": True, "delete": True},
            "dashboard": {"read": True},
        },
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def manager_headers(manager):
    return _token(manager.id)


@pytest.fixture
def plain_receptionist(db_session, test_clinic):
    """Front desk with no staff access at all. Must stay locked out."""
    user = User(
        clinic_id=test_clinic.id,
        email="desk@clinic.com",
        first_name="Dev", last_name="Desk", name="Dev Desk",
        role="receptionist",
        is_active=True,
        password_hash=_hash("deskpass123"),
        permissions={
            "staff": {"read": False, "write": False, "edit": False, "delete": False},
            "appointments": {"read": True, "write": True},
        },
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _new_staff(**over):
    body = {
        "name": "Priya Nair",
        "email": "priya@clinic.com",
        "username": "priya1",
        "phone": "9876543210",
        "role": "receptionist",
        "password": "welcome-priya-1",
    }
    body.update(over)
    return body


# ── 1. the grid's own key has to be the key that is read ────────────────────

def test_manager_with_staff_access_can_list_staff(client, manager_headers):
    """The headline bug: this returned 403 however much access was granted."""
    r = client.get("/api/v1/clinic-users", headers=manager_headers)
    assert r.status_code == 200, r.text


def test_manager_with_staff_access_can_add_staff(client, manager_headers, test_clinic):
    r = client.post("/api/v1/clinic-users", json=_new_staff(), headers=manager_headers)
    assert r.status_code == 201, r.text
    assert r.json()["clinic_id"] == test_clinic.id


def test_manager_can_read_devices(client, manager_headers):
    """Same key, different router. This 403 is why the staff list read
    "Never signed in" against everybody whenever a non-owner opened it."""
    r = client.get("/api/v1/devices", headers=manager_headers)
    assert r.status_code == 200, r.text


def test_the_alias_does_not_become_a_way_in(client, plain_receptionist):
    """Reading `staff` instead of `users` must not widen anything. Somebody the
    owner has switched off stays switched off."""
    headers = _token(plain_receptionist.id)
    assert client.get("/api/v1/clinic-users", headers=headers).status_code == 403
    assert client.post("/api/v1/clinic-users", json=_new_staff(),
                       headers=headers).status_code == 403


def test_staff_routes_use_the_shared_permission_helper():
    """The guards were hand-rolled, which is how they missed both the module
    alias and the action synonym. Reading the source keeps them honest — a
    reintroduced inline check would pass every test above and still 403 in
    production, because these fixtures grant the key the inline check wants.
    """
    import inspect
    from domains.auth.routes import clinic_users, users
    from domains.infrastructure.routes import devices

    for module in (clinic_users, users, devices):
        src = inspect.getsource(module)
        assert 'permissions.get("users"' not in src, \
            f"{module.__name__} reads the raw permission dict again"
        assert "has_permission(" in src, \
            f"{module.__name__} no longer uses the shared helper"


# ── 2. role is a guard, not a dropdown ──────────────────────────────────────

def test_non_owner_cannot_create_an_owner(client, manager_headers):
    """clinic_owner bypasses every permission check in the app, so handing one
    out is handing over the clinic."""
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(role="clinic_owner"), headers=manager_headers)
    assert r.status_code == 403, r.text


def test_owner_cannot_create_a_second_owner_either(client, auth_headers):
    """assignable_by excludes clinic_owner for everyone. Ownership transfers,
    it is not issued."""
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(role="clinic_owner"), headers=auth_headers)
    assert r.status_code == 403, r.text


def test_a_role_that_does_not_exist_is_refused(client, auth_headers):
    """"Doctor" is not "doctor". Stored with the capital, they never appear on
    the calendar, cannot be given working hours, and are silently seeded with a
    receptionist's access."""
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(role="Doctor"), headers=auth_headers)
    assert r.status_code == 400, r.text


def test_non_owner_cannot_raise_their_own_role(client, manager, manager_headers):
    """The escalation that mattered: one PUT against your own row."""
    r = client.put(f"/api/v1/clinic-users/{manager.id}",
                   json={"role": "clinic_owner"}, headers=manager_headers)
    assert r.status_code in (400, 403), r.text


def test_nobody_changes_their_own_role_even_sideways(client, manager, manager_headers):
    r = client.put(f"/api/v1/clinic-users/{manager.id}",
                   json={"role": "assistant"}, headers=manager_headers)
    assert r.status_code == 400, r.text


def test_saving_permissions_resends_the_unchanged_role(client, auth_headers,
                                                       plain_receptionist):
    """The permissions tab posts {role, permissions} together on every save. An
    unchanged role must not trip the new validation."""
    r = client.put(
        f"/api/v1/clinic-users/{plain_receptionist.id}",
        json={"role": "receptionist", "permissions": {"appointments": {"read": True}}},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text


def test_owner_can_still_assign_an_ordinary_role(client, auth_headers):
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(role="in_house_doctor"), headers=auth_headers)
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "in_house_doctor"


# ── 3. an account nobody can sign into is not a staff member ────────────────

def test_a_password_is_required(client, auth_headers):
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(password=""), headers=auth_headers)
    assert r.status_code == 400, r.text
    assert "sign in" in r.json()["detail"].lower()


def test_a_short_password_is_refused(client, auth_headers):
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(password="short"), headers=auth_headers)
    assert r.status_code == 400, r.text


def test_the_new_member_can_actually_sign_in(client, auth_headers):
    """has_password is derived rather than stored, so the create handler has to
    build the response by hand. It used to return the ORM row, which told a
    freshly created user they had no password."""
    r = client.post("/api/v1/clinic-users", json=_new_staff(), headers=auth_headers)
    assert r.status_code == 201, r.text
    assert r.json()["has_password"] is True


# ── 4. the create returns before anything is sent ───────────────────────────

def test_the_welcome_is_queued_not_awaited(client, auth_headers, monkeypatch):
    """The email and the WhatsApp send used to run between the commit and the
    return, with a ten-second timeout against a client that gives up at thirty.
    A slow Nexus meant the browser abandoned a request whose row was already
    committed: "Could not add this person", then "that email already exists"
    for somebody who did.

    A background task still runs under TestClient, so this asserts on ordering
    rather than absence: the row exists before the send is entered.
    """
    seen = {}

    import domains.auth.routes.clinic_users as mod

    def fake_send(**kwargs):
        seen.update(kwargs)

    monkeypatch.setattr(mod, "_send_staff_welcome", fake_send)
    r = client.post("/api/v1/clinic-users", json=_new_staff(),
                    headers=auth_headers)
    assert r.status_code == 201, r.text
    # queued with the plaintext password, which exists nowhere else by now
    assert seen.get("password") == "welcome-priya-1"
    assert seen.get("user_id") == r.json()["id"]


def test_the_response_says_what_is_on_its_way(client, auth_headers):
    """The handler used to compute this and throw it away, so the screen that
    had just added somebody could not say whether an invitation went out."""
    r = client.post("/api/v1/clinic-users", json=_new_staff(),
                    headers=auth_headers)
    assert r.status_code == 201, r.text
    assert r.json()["invitation"] == {"email": "sending", "whatsapp": "sending"}


def test_both_channels_are_always_on_now(client, auth_headers):
    """Email, username and WhatsApp number are all required, so every new staff
    member is reachable on both channels. There is no longer a shape of input
    that produces a "none"."""
    r = client.post("/api/v1/clinic-users", json=_new_staff(), headers=auth_headers)
    assert r.status_code == 201, r.text
    assert r.json()["invitation"] == {"email": "sending", "whatsapp": "sending"}


@pytest.mark.parametrize("missing,word", [("email", "email"), ("username", "username")])
def test_both_identifiers_are_required(client, auth_headers, missing, word):
    """It used to accept one or the other and explain the choice in a line under
    the fields. Somebody added with only a username had no address the
    invitation could reach, so the email half silently did nothing."""
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(**{missing: None}), headers=auth_headers)
    assert r.status_code == 400, r.text
    assert word in r.json()["detail"].lower()


# ── 5. a clash is explained, and a race is not a 500 ────────────────────────

def test_duplicate_email_says_why(client, auth_headers, test_user):
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(email=test_user.email), headers=auth_headers)
    assert r.status_code == 400, r.text
    assert "email" in r.json()["detail"].lower()


def test_duplicate_username_offers_one_that_works(client, auth_headers):
    first = client.post("/api/v1/clinic-users",
                        json=_new_staff(email="one@clinic.com", username="reception1"),
                        headers=auth_headers)
    assert first.status_code == 201, first.text

    again = client.post("/api/v1/clinic-users",
                        json=_new_staff(name="Other Person", email="two@clinic.com",
                                        username="reception1"),
                        headers=auth_headers)
    assert again.status_code == 400, again.text
    detail = again.json()["detail"]
    assert "username" in detail.lower()
    # a concrete alternative, not just a refusal
    assert "free" in detail.lower()


def test_a_race_is_a_conflict_not_a_crash(client, auth_headers, monkeypatch):
    """Two owners adding the same person both pass the read-then-write check and
    the database settles it. That used to surface as a bare 500."""
    from sqlalchemy.exc import IntegrityError
    import domains.auth.routes.clinic_users as mod

    real_commit = mod.Session.commit
    calls = {"n": 0}

    def flaky_commit(self):
        calls["n"] += 1
        if calls["n"] == 1:
            raise IntegrityError("insert", {}, Exception("duplicate key"))
        return real_commit(self)

    monkeypatch.setattr(mod.Session, "commit", flaky_commit, raising=False)
    r = client.post("/api/v1/clinic-users", json=_new_staff(), headers=auth_headers)
    assert r.status_code == 409, r.text


# ── 6. who may hand out which role ──────────────────────────────────────────

def test_a_delegated_manager_is_offered_the_front_desk_roles(client, manager_headers):
    """assignable_by used to return nothing for a non-clinical role, so the role
    dropdown came back empty for exactly the person an owner delegates hiring
    to — and once roles were enforced on write, their Staff grant did nothing."""
    r = client.get("/api/v1/clinic-users/roles", headers=manager_headers)
    assert r.status_code == 200, r.text
    offered = {row["value"] for row in r.json()}
    assert offered == {"receptionist", "assistant"}


def test_nobody_is_ever_offered_clinic_owner(client, auth_headers, manager_headers):
    for headers in (auth_headers, manager_headers):
        r = client.get("/api/v1/clinic-users/roles", headers=headers)
        assert "clinic_owner" not in {row["value"] for row in r.json()}


def test_a_manager_still_cannot_create_a_dentist(client, manager_headers):
    """Delegating hiring is not delegating who may treat patients."""
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(role="in_house_doctor"), headers=manager_headers)
    assert r.status_code == 403, r.text


# ── 7. billing belongs to the owner alone ───────────────────────────────────

# Bodies are well-formed on purpose. FastAPI validates the request body before
# the handler runs, so an empty {} answers 422 and never reaches the guard —
# which would make this suite pass without proving anything about the guard.
BILLING_ENDPOINTS = [
    ("get", "/api/v1/subscriptions", None),
    ("get", "/api/v1/subscriptions/history", None),
    ("get", "/api/v1/subscriptions/verify-status?order_id=x", None),
    ("post", "/api/v1/subscriptions/start-trial", {}),
    ("post", "/api/v1/subscriptions/checkout", {"plan_name": "pro"}),
    ("post", "/api/v1/subscriptions/validate-coupon", {"code": "X", "plan_name": "pro"}),
]


@pytest.mark.parametrize("method,path,body", BILLING_ENDPOINTS)
def test_staff_cannot_touch_billing(client, manager_headers, method, path, body):
    """Nothing in the subscriptions router checked anything beyond "is signed
    in", so a receptionist could read what the clinic pays, pull the payment
    history, and POST a checkout against the owner's account. The frontend hid
    the buttons; a hidden button is not a closed door.

    `manager` deliberately holds full staff permissions — this must be refused
    on role, not on the permission grid, because billing is never delegated.
    """
    kwargs = {"json": body} if body is not None else {}
    r = getattr(client, method)(path, headers=manager_headers, **kwargs)
    assert r.status_code == 403, f"{method.upper()} {path} returned {r.status_code}"


@pytest.mark.parametrize("path", [
    "/api/v1/subscriptions/plans",
    "/api/v1/subscriptions/usage",
    "/api/v1/subscriptions/featured-promo",
])
def test_the_plan_catalogue_stays_open_to_staff(client, manager_headers, path):
    """The catalogue and the clinic's own usage counters are not billing. The
    whole app reads them to label features and draw meters, so gating them
    would break the product for every non-owner."""
    r = client.get(path, headers=manager_headers)
    assert r.status_code != 403, f"{path} should not be owner-gated"


# ── 8. the WhatsApp number is not optional ──────────────────────────────────

def test_a_whatsapp_number_is_required(client, auth_headers):
    """It is the channel the details actually arrive on. Front-desk staff often
    have no work email, so an optional phone meant the only delivery that would
    have reached them silently did not happen."""
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(phone=""), headers=auth_headers)
    assert r.status_code == 400, r.text
    assert "whatsapp" in r.json()["detail"].lower()


def test_a_short_phone_is_refused(client, auth_headers):
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(phone="98765"), headers=auth_headers)
    assert r.status_code == 400, r.text


def test_a_formatted_number_is_accepted(client, auth_headers):
    """Owners paste numbers with spaces, dashes and a country code. Only the
    digits are counted."""
    r = client.post("/api/v1/clinic-users",
                    json=_new_staff(phone="+91 98765-43210"), headers=auth_headers)
    assert r.status_code == 201, r.text
