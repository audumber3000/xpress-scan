from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, status, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models import User, Clinic
from core.login_identifier import (
    email_matches,
    normalize_email,
    normalize_username,
    username_matches,
)
from typing import List, Optional
from pydantic import BaseModel, Field
import datetime
from datetime import date
from core.auth_utils import get_current_user, has_permission
from core.audit import (record_audit, STAFF_CREATED, STAFF_UPDATED,
                        STAFF_DEACTIVATED, PERMISSIONS_CHANGED, PASSWORD_CHANGED)
import hashlib
import logging
import os
import re
import requests
from core.roles import assignable_by, label_for, ROLE_VALUES

# Staff passwords go through the same scheme as everybody else's.
from core.passwords import hash_password

logger = logging.getLogger(__name__)

router = APIRouter()


# Who may touch staff records.
#
# Every handler below used to read the raw permission dict itself, asking for
# the module `users` and the action `view`. That is wrong twice over: the
# permission grid writes the module as `staff` and the action as `read`, and
# nothing translated between them. So the check read a key no staff account has
# ever carried, and every route here was a 403 for every non-owner however much
# access the owner had granted. The reported symptom was exactly that — an owner
# ticks Staff/Admin for their manager, and the manager still sees "You don't
# have permission to view staff management".
#
# core.auth_utils.has_permission already knows that `users` and `staff` name one
# module and that `view` and `read` name one action; it is the same helper that
# fixed the identical billing/finance bug. Routed through one function here so
# the next handler cannot quietly go back to reading the dict.
_ACTION_WORDING = {
    "view": "view staff",
    "edit": "add or change staff",
    "delete": "remove staff",
}


def _require_staff(current_user, action: str) -> None:
    if has_permission(current_user, action, "users"):
        return
    raise HTTPException(
        status_code=403,
        detail=f"You don't have permission to {_ACTION_WORDING.get(action, action)}.",
    )


def _validate_role(current_user, role: str) -> str:
    """The role being handed out, checked — or a refusal naming what is allowed.

    `role` arrived as a free string and went straight to the column, while
    core.roles.assignable_by — which exists for precisely this question — was
    only ever used to fill the dropdown. Two things followed from that.

    A non-owner with staff-edit could mint a second clinic_owner, and the owner
    role bypasses every permission check in the app, so that is a takeover
    rather than an over-grant. And any typo went in: somebody stored as "Doctor"
    rather than "doctor" never appears on the calendar, cannot be given working
    hours, and is quietly seeded with a receptionist's access.

    A dropdown is not a guard.
    """
    role = (role or "").strip()
    if role not in ROLE_VALUES:
        raise HTTPException(
            status_code=400,
            detail=f"\u201c{role}\u201d is not a role in this clinic.",
        )
    allowed = {r["value"] for r in assignable_by(getattr(current_user, "role", None))}
    if role not in allowed:
        offer = ", ".join(sorted(label_for(r) for r in allowed))
        raise HTTPException(
            status_code=403,
            detail=(
                f"You can't give somebody the {label_for(role)} role. "
                + (f"You can assign: {offer}." if offer
                   else "Ask the clinic owner to set their role.")
            ),
        )
    return role

class ClinicUserIn(BaseModel):
    email: Optional[str] = None  # Required for owners; optional for staff
    username: Optional[str] = None  # Login identifier for staff (no email required)
    name: str
    role: str = "receptionist"
    permissions: Optional[dict] = {}
    # Optional in the schema, required by the handler. Deliberate: leaving it
    # nullable here means a missing password comes back as a sentence somebody
    # can act on rather than a 422 about a field name.
    password: Optional[str] = None
    phone: Optional[str] = None     # so the welcome can also go out on WhatsApp
    # What this person is paid per case, if anything. Set once here rather than
    # typed on every case paper.
    fee_basis: Optional[str] = None    # fixed | percentage | None
    fee_value: Optional[float] = None

class ClinicUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[dict] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None  # Password for desktop / mobile login
    phone: Optional[str] = None
    fee_basis: Optional[str] = None
    fee_value: Optional[float] = None
    # Everything below is optional detail, filled in from the staff member's
    # own profile rather than asked for while adding them. Somebody hiring a
    # receptionist on a Tuesday morning should not be blocked on knowing their
    # pay day.
    avatar_url: Optional[str] = None
    salary_amount: Optional[float] = None
    salary_day: Optional[int] = Field(None, ge=1, le=31)
    joined_on: Optional[date] = None

class SetPasswordRequest(BaseModel):
    password: str

class ClinicUserOut(BaseModel):
    id: int
    email: Optional[str] = None
    username: Optional[str] = None
    name: str
    role: str
    clinic_id: Optional[int] = None
    is_active: bool
    created_at: datetime.datetime
    permissions: Optional[dict] = {}
    has_password: Optional[bool] = False  # Whether user has a password set
    phone: Optional[str] = None
    fee_basis: Optional[str] = None
    fee_value: Optional[float] = None
    salary_amount: Optional[float] = None
    salary_day: Optional[int] = None
    joined_on: Optional[date] = None
    # The person's own profile photo. Without it every staff list falls back to
    # a generated cartoon, so uploading a picture appeared to do nothing outside
    # the profile page itself.
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class ClinicUserCreated(ClinicUserOut):
    """A freshly added staff member, plus what is on its way to them.

    Separate from ClinicUserOut so the list endpoint stays the plain record.
    The create handler used to work out exactly this and then drop it on the
    floor — a local `delivery` dict that was never returned — so the screen that
    had just added somebody could not say whether the invitation went out, and
    guessed. `invitation` is deliberately about intent, not outcome: the sends
    now happen after the response, so the honest word is "sending". Whether each
    one landed is recorded in the notification log.
    """
    invitation: dict = {}


def _serialize_user(user: User) -> ClinicUserOut:
    """One shape for a staff member, used by every handler that returns one.

    `has_password` is derived, not stored, so returning the ORM object directly
    lets Pydantic fall back to the field default of False. The list endpoint
    always built this by hand; update and create returned `user` raw, which meant
    saving a password answered "has_password: false" to the screen that had just
    set it — the UI then showed "No password yet" for somebody who could log in
    perfectly well.
    """
    return ClinicUserOut(
        id=user.id,
        email=user.email,
        username=user.username,
        name=user.name,
        role=user.role,
        clinic_id=user.clinic_id,
        is_active=user.is_active,
        created_at=user.created_at,
        permissions=user.permissions or {},
        has_password=bool(user.password_hash),
        avatar_url=user.avatar_url,
        phone=user.phone,
        fee_basis=user.fee_basis,
        fee_value=user.fee_value,
        salary_amount=user.salary_amount,
        salary_day=user.salary_day,
        joined_on=user.joined_on,
    )


@router.get("", response_model=List[ClinicUserOut])
def get_clinic_users(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get all clinic users for current clinic"""
    # Check if user has permission to view users
    _require_staff(current_user, "view")
    
    try:
        users = db.query(User).filter(
            User.clinic_id == current_user.clinic_id
        ).all()
        return [_serialize_user(u) for u in users]
    except Exception as e:
        # str(e) here was a SQLAlchemy exception on its way to a dentist's
        # screen. The reason belongs in the log, not in the response.
        logger.error("Failed to list clinic users: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Could not load your staff list.")

class BookableDoctor(BaseModel):
    """Just enough to put a name in a dropdown and on a card."""
    id: int
    name: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None


@router.get("/bookable", response_model=List[BookableDoctor])
def get_bookable_doctors(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Who an appointment can be booked with, for anyone who works here.

    Separate from the list above, deliberately. That one answers "show me the
    staff records" and is gated on users.view because it carries email, phone,
    permissions, fee terms and salary_amount. Booking an appointment needs none
    of that — it needs a name to put in a dropdown — and gating the two together
    is why a receptionist with full appointment rights saw an empty doctor list
    and every card reading "Unassigned".

    Not an additional disclosure: the appointment list already shows these names
    to anyone who can open the calendar. This returns the same names without the
    salaries attached, so the booking form stops depending on a permission that
    exists to protect payroll.

    Scoped to the caller's own clinic, and inactive staff are left out: someone
    who has left should not be bookable, but their past appointments still name
    them correctly because those read the stored doctor_id.
    """
    users = db.query(User).filter(
        User.clinic_id == current_user.clinic_id,
        User.is_active.is_(True),
        User.role.in_(["doctor", "clinic_owner", "in_house_doctor", "associate"]),
    ).all()
    # `name` is never blank on the way out. Five call sites render
    # `d.name || d.email`, and email is deliberately not in this payload, so a
    # nameless row would have rendered an empty option nobody could pick. No
    # such row exists in prod today; this makes sure one cannot appear later.
    return [
        BookableDoctor(
            id=u.id,
            name=(u.name or "").strip() or f"Staff #{u.id}",
            role=u.role,
            avatar_url=u.avatar_url,
        )
        for u in users
    ]


def _suggest_username(db: Session, wanted: str, clinic) -> Optional[str]:
    """A username close to the one they asked for that is actually free."""
    base = normalize_username(wanted) or "staff"
    # The clinic's first word, not the first twelve characters of its name:
    # "Live Test Clinic" should suggest "…​.live", not "…​.livetestclin".
    words = re.findall(r"[a-z0-9]+", (getattr(clinic, "name", "") or "").lower())
    slug = (words[0] if words else "")[:12]
    for candidate in ([f"{base}.{slug}"] if slug else []) + [f"{base}{n}" for n in range(2, 8)]:
        if not db.query(User).filter(username_matches(candidate)).first():
            return candidate
    return None


def _send_staff_welcome(
    user_id: int,
    clinic_id: int,
    name: str,
    email: Optional[str],
    username: Optional[str],
    phone: Optional[str],
    role: str,
    password: str,
    inviter_name: str,
) -> None:
    """Hand the new staff member their sign-in details, after the response.

    This used to run inside the POST, between the commit and the return: an
    HTTP call to Nexus with a ten-second timeout, then the WhatsApp send. The
    client gives up at thirty. So adding somebody hung for ten seconds on a good
    day, and on a bad one the browser abandoned a request whose row had already
    been committed — the owner saw "Could not add this person", pressed Add
    again, and was told the email already exists, for somebody who did exist.
    Creating the account and telling them about it are two jobs, and only the
    first is what the owner is waiting on.

    Its own session: the request's is closed by the time this runs.

    Nothing in here may raise. The account exists either way, and the owner is
    already holding the sign-in details on screen — every send here is a
    convenience on top of that, never the only copy.
    """
    db = SessionLocal()
    try:
        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if not clinic:
            return
        # Both identifiers travel, not just whichever one we happened to pick.
        # A staff member given an email AND a username was only ever told about
        # one of them, so the other was a credential nobody knew existed.
        login_id = email or username or ""

        if email:
            # Through Nexus, which is the only thing in this system that can
            # send email. This called EmailService directly, which talks to
            # Zoho, and no ZOHO_* variables reach the backend container in
            # production — so every staff invitation ever created failed on the
            # first line and was logged as a warning nobody was reading.
            try:
                resp = requests.post(
                    f"{os.getenv('NEXUS_SERVICES_URL', 'http://localhost:8001')}"
                    f"/api/v1/notifications/send-event",
                    json={
                        "event_type": "staff_invitation",
                        "channel": "email",
                        "to_email": email,
                        "to_name": name,
                        "template_data": {
                            "staff_name": name,
                            "clinic_name": clinic.name or "",
                            "role": label_for(role),
                            "inviter_name": inviter_name,
                            "login_id": login_id,
                            "email": email or "",
                            "username": username or "",
                            "password": password,
                            "login_url": os.environ.get("APP_URL") or "",
                        },
                    },
                    timeout=10,
                )
                if resp.status_code >= 400:
                    # Deliberately not logging the body: template_data carries
                    # the new staff member's password.
                    logger.warning(
                        "staff invitation email refused for user %s: HTTP %s",
                        user_id, resp.status_code,
                    )
            except Exception as exc:  # noqa: BLE001
                logger.warning("staff welcome email failed for user %s: %s",
                               user_id, type(exc).__name__)

        if phone:
            try:
                from core.notification_dispatch import notify_event
                notify_event(
                    "staff_welcome",
                    db=db,
                    clinic_id=clinic_id,
                    to_phone=phone,
                    to_email=email or "",
                    to_name=name,
                    template_data={
                        "clinic_name": clinic.name or "",
                        "staff_name": name,
                        "role": label_for(role),
                        "inviter_name": inviter_name,
                        "login_id": login_id,
                        "email": email or "",
                        "username": username or "",
                        "password": password,
                        "app_url": os.environ.get("APP_URL", ""),
                    },
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("staff welcome whatsapp failed for user %s: %s",
                               user_id, type(exc).__name__)
    except Exception:  # noqa: BLE001
        logger.exception("staff welcome failed for user %s", user_id)
    finally:
        db.close()


@router.post("", response_model=ClinicUserCreated, status_code=status.HTTP_201_CREATED)
def add_clinic_user(
    user_in: ClinicUserIn,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Add somebody to this clinic and hand them a way in.

    The whole job is: check they may be added, write the row, and return. The
    welcome email and the WhatsApp message are queued behind the response, not
    waited on — see _send_staff_welcome for why that mattered.
    """
    _require_staff(current_user, "edit")

    role = _validate_role(current_user, user_in.role)

    # Normalise inputs — treat empty strings as missing
    email = normalize_email(user_in.email) or None
    username = normalize_username(user_in.username) or None

    # Both, not either.
    #
    # This accepted one or the other, and the form explained the choice in a
    # line under the fields. Two costs: the commonest screen in staff setup
    # became a small decision instead of a small form, and a staff member added
    # with only a username had no address the invitation could reach — so the
    # email half of the welcome silently did nothing.
    #
    # Only enforced on creation. Existing rows that predate this carry one or
    # the other and must stay editable, so update_clinic_user is deliberately
    # left permissive.
    if not email:
        raise HTTPException(status_code=400, detail="Add their email address.")
    if not username:
        raise HTTPException(
            status_code=400,
            detail="Give them a username to sign in with.",
        )

    # Both identifiers are global, because signing in is: nobody types which
    # clinic they belong to. So a clash is usually with a stranger's account,
    # not with somebody down the corridor, and "already taken" on its own reads
    # as a bug. Say which of the two it is, why, and what to do instead.
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()

    if email and db.query(User).filter(email_matches(email)).first():
        raise HTTPException(
            status_code=400,
            detail=(
                "That email address already has a MolarPlus account. If they work "
                "at another clinic too, use a different address for them here."
            ),
        )

    if username and db.query(User).filter(username_matches(username)).first():
        hint = _suggest_username(db, username, clinic)
        raise HTTPException(
            status_code=400,
            detail=(
                f"The username \u201c{username}\u201d is taken. Usernames are shared "
                f"across every clinic on MolarPlus, so the short ones went early."
                + (f" \u201c{hint}\u201d is free." if hint else "")
            ),
        )

    # Split name into first_name and last_name
    name_parts = user_in.name.strip().split(maxsplit=1)
    first_name = name_parts[0] if name_parts else user_in.name
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    # A WhatsApp number is required, for the same reason the password is.
    #
    # It is the channel the sign-in details actually arrive on. Front-desk staff
    # frequently have no work email, so when the phone was optional the only
    # delivery that would have reached them simply did not happen, and the owner
    # had no way of knowing. Enforced here and not only on the form, because a
    # required field in the UI stops a slip, not a direct call.
    phone = (user_in.phone or "").strip()
    phone_digits = re.sub(r"\D", "", phone)
    if not phone_digits:
        raise HTTPException(
            status_code=400,
            detail="Add their WhatsApp number. Their sign-in details are sent there.",
        )
    if len(phone_digits) < 10:
        raise HTTPException(
            status_code=400,
            detail="That WhatsApp number looks too short. Check it and try again.",
        )

    # A password is required, where it used to be optional.
    #
    # Optional sounds harmless and was not. The form said "leave blank and they
    # can be given one later", owners left it blank, and the invitation went out
    # with an empty password field — so the new staff member got a welcome with
    # no way in, and the clinic found out days later when they tried to work.
    # An account that cannot be signed into is not a staff member, it is a row.
    password = (user_in.password or "").strip()
    if not password:
        raise HTTPException(
            status_code=400,
            detail="Set a password for them, otherwise they have no way to sign in.",
        )
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="A password needs at least 8 characters.")
    password_hash = hash_password(password)

    # Seed sensible role defaults when none are supplied, so a new staff member
    # is immediately usable rather than locked out with an empty permission set.
    from domains.auth.role_presets import default_permissions_for
    permissions = user_in.permissions or default_permissions_for(role)

    user = User(
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        name=user_in.name,
        role=role,
        clinic_id=current_user.clinic_id,
        created_by=current_user.id,
        permissions=permissions,
        password_hash=password_hash,
        phone=phone,
        fee_basis=(user_in.fee_basis or None),
        fee_value=user_in.fee_value,
    )
    db.add(user)
    db.flush()
    # Creating a login is how someone gains access to patient records, so it
    # belongs in the log next to the permission changes that follow it.
    record_audit(
        db, current_user, STAFF_CREATED,
        f"Added {user.name or user.email} as {label_for(user.role)}",
        request=request, entity_type='user', entity_id=user.id,
    )
    try:
        db.commit()
    except IntegrityError:
        # The checks above are a read followed by a write, so two owners adding
        # the same person at the same moment both pass them and the database
        # settles it. That used to surface as a bare 500. It is the same
        # situation the pre-check describes, so it gets the same words.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Somebody just took that email address or username. "
                "Try a different one."
            ),
        )
    db.refresh(user)

    # Their sign-in details, on every channel we have. Queued rather than
    # awaited: see _send_staff_welcome. The owner is not kept waiting on Nexus,
    # and is holding the same details on screen regardless.
    invitation = {
        "email": "sending" if email else "none",
        "whatsapp": "sending" if (user.phone or "") else "none",
    }
    background.add_task(
        _send_staff_welcome,
        user_id=user.id,
        clinic_id=current_user.clinic_id,
        name=user.name or "",
        email=email,
        username=username,
        phone=user.phone,
        role=user.role,
        password=password,
        inviter_name=current_user.name or current_user.email or "",
    )

    # Who can get into the clinic's records is the owner's business, even when
    # the owner is the one adding them. Excluded as actor so an owner adding
    # staff themselves is not told about it, which leaves the case that matters:
    # a manager or another owner adding someone.
    try:
        from domains.notification.services.notification_center_service import (
            notify, OWNER, SEVERITY_INFO,
        )
        notify(
            db,
            clinic_id=current_user.clinic_id,
            event_type="staff_added",
            severity=SEVERITY_INFO,
            audience=OWNER,
            actor_user_id=current_user.id,
            title="Staff member added",
            body=f"{user.name} joined as {label_for(user.role)}, "
                 f"added by {current_user.name or current_user.email}",
            link="/admin/staff",
            entity_type="user",
            entity_id=user.id,
        )
        db.commit()
    except Exception:
        db.rollback()

    # has_password is derived rather than stored, so returning the ORM row would
    # tell a freshly-created user they have no password when one was just set.
    return ClinicUserCreated(**_serialize_user(user).model_dump(), invitation=invitation)

# Every table that would be orphaned or would block a hard delete. Forty-three
# columns reference users.id and twelve of them are NOT NULL, so removing a
# staff member who has done anything at all either raises a ForeignKeyViolation
# or quietly severs history somebody will later need. user_devices.user_id is
# the one that bites first: it is NOT NULL and every user gets a row the moment
# they sign in, so before this guard existed, deleting essentially any real
# staff member returned a bare 500.
_HISTORY_CHECKS = (
    ('UserDevice',  'user_id',    'has signed in'),
    ('Attendance',  'user_id',    'has attendance recorded'),
    ('Appointment', 'doctor_id',  'is on appointments'),
    ('Invoice',     'created_by', 'has raised invoices'),
    ('AuditLog',    'user_id',    'appears in the audit log'),
)


def _history_reason(db, user_id: int):
    """The first reason this person cannot simply be erased, or None."""
    import models
    for model_name, column, phrase in _HISTORY_CHECKS:
        model = getattr(models, model_name, None)
        if model is None:
            continue
        try:
            if db.query(model).filter(getattr(model, column) == user_id).first():
                return phrase
        except Exception:
            # A check that cannot run must not be read as "no history".
            return 'has records in this clinic'
    return None


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clinic_user(user_id: int, request: Request, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Remove a staff member who was added by mistake.

    Deliberately narrow. Deleting somebody who has actually worked here is not a
    tidy-up, it is the destruction of the record of who saw which patient and
    who took which payment — and the audit log exists precisely so that cannot
    happen quietly. Anyone with history is refused and pointed at Deactivate,
    which is what the UI offers anyway and what the rest of this app means by
    "remove a person".
    """
    _require_staff(current_user, "delete")

    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Deleting yourself leaves nobody holding the account you were just using.
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You can't remove your own account. Ask another owner to do it.",
        )

    # The same protection the deactivate path has always had. Without it, a
    # staff member with users.delete could remove the owner and leave the clinic
    # with nobody able to administer it.
    if user.role == 'clinic_owner':
        raise HTTPException(
            status_code=400,
            detail="The clinic owner can't be removed. Transfer ownership first.",
        )

    reason = _history_reason(db, user.id)
    if reason:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{user.name} {reason}, so their record has to stay for your history to make sense. "
                f"Deactivate them instead — they lose access immediately and nothing is lost."
            ),
        )

    label = f"{user.name} ({user.email or user.username or f'#{user.id}'})"
    db.delete(user)
    # Removing a person is exactly the kind of thing the log exists for, and it
    # was the one staff action that went unrecorded.
    record_audit(db, current_user, STAFF_DEACTIVATED,
                 f"Removed {label} from the clinic",
                 request=request, entity_type='user', entity_id=user_id)

    # Somebody losing access is worth more than an audit-log line. Deliberately
    # `action` rather than `info`: if the owner did not expect this, it wants
    # looking at today.
    try:
        from domains.notification.services.notification_center_service import (
            notify, OWNER, SEVERITY_ACTION,
        )
        notify(
            db,
            clinic_id=current_user.clinic_id,
            event_type="staff_removed",
            severity=SEVERITY_ACTION,
            audience=OWNER,
            actor_user_id=current_user.id,
            title="Staff member removed",
            body=f"{label} was removed by {current_user.name or current_user.email}",
            link="/admin/staff",
            entity_type="user",
            entity_id=user_id,
        )
    except Exception:
        logger.exception("staff_removed notification failed")

    db.commit()
    # 204 means no body. The old handler returned a JSON message with it, which
    # is a contradiction some clients treat as a malformed response.
    return None

@router.put("/{user_id}", response_model=ClinicUserOut)
def update_clinic_user(user_id: int, user_update: ClinicUserUpdate, request: Request, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Update clinic user - scoped by clinic"""
    # Check if user has permission to edit users
    _require_staff(current_user, "edit")
    
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    if user_update.name is not None:
        user.name = user_update.name
    if user_update.email is not None:
        new_email = normalize_email(user_update.email) or None
        if new_email and new_email != user.email:
            clash = db.query(User).filter(email_matches(new_email), User.id != user.id).first()
            if clash:
                raise HTTPException(status_code=400, detail="A user with this email already exists")
        user.email = new_email
    if user_update.username is not None:
        new_username = normalize_username(user_update.username) or None
        if new_username and new_username != user.username:
            clash = db.query(User).filter(username_matches(new_username), User.id != user.id).first()
            if clash:
                raise HTTPException(status_code=400, detail="This username is already taken")
        user.username = new_username
    if user_update.role is not None and (user_update.role or "").strip() != user.role:
        # Nobody changes their own role, in either direction.
        #
        # The downward half was already guarded: an owner who demotes themselves
        # loses the screen that would undo it. The upward half was not, and it
        # was the more serious of the two — a receptionist with staff-edit could
        # PUT their own row with role "clinic_owner", and clinic_owner bypasses
        # every permission check in this application. That is not an over-grant,
        # it is the clinic.
        if user.id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="You can't change your own role. Ask another owner to do it.",
            )
        # Same guard as creation: a role has to be a real one, and one this
        # person is allowed to hand out. Skipped when the role is unchanged,
        # because the permissions tab posts the current role alongside the grid
        # on every save and that must not start failing.
        user.role = _validate_role(current_user, user_update.role)
    if user_update.permissions is not None:
        # Nobody edits their own permissions. An owner who switches off their own
        # access loses the very screen that could restore it, and there is no
        # in-app way back — it takes a database edit. Enforced here and not only
        # in the UI, because a disabled button stops a slip, not a direct call.
        if user.id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="You can't change your own permissions — it would lock you out.",
            )
        # The owner's access is not editable by anyone: a staff member with
        # staff:edit could otherwise strip the owner and take over the clinic.
        if user.role == 'clinic_owner':
            raise HTTPException(
                status_code=400,
                detail="The clinic owner always has full access, and it can't be edited.",
            )
        user.permissions = user_update.permissions
        record_audit(db, current_user, PERMISSIONS_CHANGED,
                     f"Changed module permissions for {user.name}",
                     request=request, entity_type='user', entity_id=user.id)

        # Who can see what is an owner-level concern. Collapsed over an hour so
        # working through the permissions grid for one person is one line rather
        # than one per toggle.
        try:
            from domains.notification.services.notification_center_service import (
                notify, OWNER, SEVERITY_ACTION,
            )
            notify(
                db,
                clinic_id=current_user.clinic_id,
                event_type="permissions_changed",
                severity=SEVERITY_ACTION,
                audience=OWNER,
                actor_user_id=current_user.id,
                title="Staff permissions changed",
                body=f"{user.name}'s access was changed by "
                     f"{current_user.name or current_user.email}",
                link="/admin/staff",
                entity_type="user",
                entity_id=user.id,
                collapse_minutes=60,
            )
        except Exception:
            logger.exception("permissions_changed notification failed")
    if user_update.is_active is not None:
        if user.role == 'clinic_owner':
            raise HTTPException(status_code=400, detail="Cannot deactivate the clinic owner")
        user.is_active = user_update.is_active
        record_audit(db, current_user, STAFF_DEACTIVATED if not user_update.is_active else STAFF_UPDATED,
                     f"{'Deactivated' if not user_update.is_active else 'Reactivated'} {user.name}",
                     request=request, entity_type='user', entity_id=user.id)
    # Optional profile detail. Written straight through: none of it gates
    # anything, and an empty string means "clear it" rather than "skip it".
    for _f in ("phone", "avatar_url", "fee_basis", "fee_value",
               "salary_amount", "salary_day", "joined_on"):
        _v = getattr(user_update, _f, None)
        if _v is not None:
            setattr(user, _f, _v if _v != "" else None)

    if user_update.password is not None:
        if len(user_update.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        user.password_hash = hash_password(user_update.password)
    
    db.commit()
    db.refresh(user)
    return _serialize_user(user)

@router.post("/{user_id}/set-password")
def set_staff_password(
    user_id: int, 
    password_request: SetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    """Set or reset password for a staff member - only doctors/clinic owners can do this"""
    # Check if user has permission to edit users
    _require_staff(current_user, "edit")
    
    # Find the user
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate password
    if len(password_request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Set password hash
    user.password_hash = hash_password(password_request.password)
    # One person setting another's password is a handover of access. The
    # password itself is obviously never recorded, only that it happened and
    # who did it, which is the part that matters if an account is later
    # disputed.
    record_audit(
        db, current_user, PASSWORD_CHANGED,
        f"Set a new password for {user.name or user.email}"
        + (" (their own)" if user.id == current_user.id else ""),
        request=request, entity_type='user', entity_id=user.id,
    )
    db.commit()
    
    return {"message": "Password set successfully"}

@router.get("/roles", response_model=List[dict])
def get_available_roles(current_user = Depends(get_current_user)):
    """Get available roles based on current user's role"""
    return assignable_by(current_user.role)


# ── Salary due ───────────────────────────────────────────────────────────────

class SalaryDue(BaseModel):
    user_id: int
    name: str
    role: str
    avatar_url: Optional[str] = None
    amount: float
    due_on: date
    status: str            # 'paid' | 'due' | 'upcoming'
    expense_id: Optional[int] = None


@router.get("/salaries/due", response_model=List[SalaryDue])
def salaries_due(
    month: Optional[str] = None,   # YYYY-MM, defaults to the clinic's current month
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """What the clinic owes its staff this month.

    Derived, never stored. A salary row is not a debt the moment somebody is
    hired — it is a standing arrangement, and materialising twelve rows a year
    per employee would leave the clinic reconciling records nobody created on
    purpose. So this is computed on read from the salary on each staff member,
    and a month counts as settled when an Expense exists against that person in
    it. That reuses the ledger the clinic already keeps rather than inventing a
    second place where money is recorded.

    Only staff with a salary recorded appear. Somebody paid per case, or paid
    in cash off the books, is simply absent rather than shown as owing zero.
    """
    from models import Expense
    from core.clinic_time import clinic_today
    from calendar import monthrange

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    # The clinic's own day, not the server's: a clinic in IST should not see a
    # salary flip to "due" because a machine in another timezone rolled over.
    today = clinic_today(clinic) if clinic else datetime.date.today()

    if month:
        try:
            year, mon = (int(x) for x in month.split("-")[:2])
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Month must look like 2026-08.")
    else:
        year, mon = today.year, today.month

    start = datetime.date(year, mon, 1)
    last_day = monthrange(year, mon)[1]
    end = datetime.date(year, mon, last_day)

    staff = db.query(User).filter(
        User.clinic_id == current_user.clinic_id,
        User.is_active == True,          # noqa: E712
        User.salary_amount.isnot(None),
        User.salary_amount > 0,
    ).all()

    # One query for the month rather than one per person.
    paid_rows = db.query(Expense).filter(
        Expense.clinic_id == current_user.clinic_id,
        Expense.paid_to_user_id.isnot(None),
        Expense.date >= datetime.datetime.combine(start, datetime.time.min),
        Expense.date <= datetime.datetime.combine(end, datetime.time.max),
    ).all()
    paid_by_user = {e.paid_to_user_id: e for e in paid_rows}

    out = []
    for u in staff:
        # A pay day of 31 in a 30-day month falls on the last day rather than
        # silently vanishing.
        day = min(int(u.salary_day or 1), last_day)
        due_on = datetime.date(year, mon, day)

        # Nobody is owed for a month they had not started.
        if u.joined_on and u.joined_on > end:
            continue

        expense = paid_by_user.get(u.id)
        if expense:
            status = "paid"
        elif due_on <= today:
            status = "due"
        else:
            status = "upcoming"

        out.append(SalaryDue(
            user_id=u.id, name=u.name, role=u.role, avatar_url=u.avatar_url,
            amount=float(u.salary_amount or 0), due_on=due_on,
            status=status, expense_id=expense.id if expense else None,
        ))

    # Overdue first, then by pay day: the ones somebody has to act on today sit
    # at the top rather than in date order among those that are already settled.
    order = {"due": 0, "upcoming": 1, "paid": 2}
    out.sort(key=lambda r: (order.get(r.status, 3), r.due_on))
    return out
