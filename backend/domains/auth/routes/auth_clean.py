"""
Auth routes using clean architecture
"""
import logging
import os
import jwt
import requests
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Optional
from core.dtos import (
    LoginRequestDTO,
    RegisterRequestDTO,
    OAuthRequestDTO,
    OAuthCodeRequestDTO,
    ChangePasswordRequestDTO,
    AuthResponseDTO,
    UserResponseDTO,
    ClinicResponseDTO,
    DeviceInfoDTO,
    SuccessResponseDTO,
    UpdateProfileDTO,
)
from core.dependencies import get_auth_service, get_user_service
from core.auth_utils import require_role, get_jwt_secret
from core.auth_utils import get_current_user as _current_user_dep
from core.nexus_notify import notify
from database import get_db
from sqlalchemy.orm import Session, joinedload
from domains.notification.services.platform_notification_service import PlatformNotificationService
from models import Clinic, User, Subscription, UserDevice, user_clinics
from sqlalchemy import or_

logger = logging.getLogger(__name__)
from core.login_identifier import (
    find_user_by_email,
    find_user_by_identifier,
    normalize_email,
    normalize_identifier,
)
from core.passwords import verify_password
from core.login_throttle import throttle, client_ip, lockout_message
from datetime import datetime as _dt
from pydantic import BaseModel
from core.posthog_client import track_event, group_identify, EVENTS
from core import plans
from core import plan_bootstrap
from core.audit import (record_audit, LOGIN_SUCCEEDED, LOGIN_FAILED,
                        LOGIN_BLOCKED, LOGOUT, PASSWORD_CHANGED)

router = APIRouter()

def _signed_in_from(payload) -> str:
    """The audit line for a successful sign-in.

    Extracted because the OAuth handlers carried a copy of this expression that
    still referred to `login_data`, the parameter name from the password login
    above them. Python only resolves a name when the line runs, so it stayed
    invisible until somebody actually signed in with Google and got
    "OAuth login failed: name 'login_data' is not defined" — after being
    authenticated successfully.

    `device` may be a DTO or a plain dict depending on the caller, so it is read
    defensively rather than assuming either.
    """
    device = getattr(payload, 'device', None)
    if not device:
        return "Signed in"
    kind = device.get('type') if isinstance(device, dict) else getattr(device, 'type', None)
    return f"Signed in from {kind or 'the web app'}"




def _signed_out_reason(db: Session, token: str) -> str:
    """Why this token was refused, said the way a person would say it.

    `validate_token` collapses several different situations into None: an
    expired token, a forged one, and — most commonly in practice — a completely
    valid token belonging to somebody the owner has just deactivated. The old
    single answer, "Invalid or expired token", was wrong for that last case and
    is the string the signed-out screen puts in front of them, so a deactivated
    receptionist was told to try a password that could never work.

    Never leaks a decode error outward: anything unexpected falls back to the
    neutral sign-in-again message.
    """
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"],
                             options={"verify_exp": False})
    except Exception:
        return "Please sign in again."

    user = db.query(User).filter(User.id == payload.get("user_id")).first()
    if user and not user.is_active:
        return "Your account is no longer active at this clinic. Please contact your clinic owner."

    device_id = payload.get("did")
    if device_id is not None:
        device = db.query(UserDevice).filter(UserDevice.id == device_id).first()
        if device is not None and not device.is_active:
            return "This device has been blocked. Please contact your clinic owner."

    return "Your session has ended. Please sign in again."


# Clinics created from this date onward must verify a phone and an email before
# they can use the app; see the last step of ClinicOnboarding. Anything older is
# grandfathered, because switching a blocking check on retrospectively would
# wall every existing customer out of their own clinic on deploy day. Move this
# forward, never backward.
SIGNUP_VERIFICATION_FROM = _dt(2026, 8, 24)


def _verification_required(clinic: Clinic) -> bool:
    """Does this clinic still owe us the signup verification step?

    Either contact counts. The step sends one code to both, so having verified
    one is proof the person completed it, and a clinic whose email later bounces
    should not suddenly be locked out.
    """
    created = getattr(clinic, "created_at", None)
    if not created or created < SIGNUP_VERIFICATION_FROM:
        return False
    return not (clinic.security_phone_verified or clinic.security_email_verified)


def _enrich_clinic_dto(db: Session, clinic: Clinic) -> ClinicResponseDTO:
    """Build a ClinicResponseDTO and attach the owner's subscription info
    (plan_name, is_trial, plan_ends_at, trial_days_remaining) for header display."""
    dto = ClinicResponseDTO.from_orm(clinic)
    dto.security_verification_required = _verification_required(clinic)
    # Defaulted here so it is present on EVERY path out of this function, including
    # the two early returns below. A field that is sometimes absent is worse than
    # one that is sometimes stale: the reader falls through to a different field
    # and the two clients disagree about which plan the clinic is on.
    dto.effective_plan = plans.key_of(clinic.subscription_plan)
    try:
        from core import plan_state as _ps
        _state = _ps.for_clinic(db, clinic)
        dto.plan_state = _state.get("state")
        dto.plan_state_days = _state.get("days_left")
        dto.plan_state_title = _state.get("title")
    except Exception:
        # A billing read must never break /auth/me. Without a state the header
        # simply shows no warning, which is the safe way to be wrong.
        pass
    owner = (
        db.query(User)
        .join(user_clinics, user_clinics.c.user_id == User.id)
        .filter(
            user_clinics.c.clinic_id == clinic.id,
            user_clinics.c.role == "clinic_owner",
            user_clinics.c.is_active == True,
        )
        .first()
    )
    if not owner:
        owner = (
            db.query(User)
            .filter(User.clinic_id == clinic.id, User.role == "clinic_owner", User.is_active == True)
            .first()
        )
    if not owner:
        return dto
    sub = (
        db.query(Subscription)
        .filter(or_(Subscription.clinic_id == clinic.id, Subscription.user_id == owner.id))
        .order_by(Subscription.id.desc())
        .first()
    )
    if not sub:
        # No subscription row yet → brand-new clinic, eligible for a free trial.
        dto.trial_available = True
        return dto
    now = _dt.utcnow()
    is_expired = bool(
        sub.current_end and sub.current_end < now
    )
    dto.is_trial = bool(getattr(sub, "is_trial", False) and sub.status == "active" and not is_expired)

    # Eligible to start a trial only if one was never used and they aren't
    # already paying. Kept deliberately identical to the same computation in
    # subscriptions.py::get_current_subscription — the header badge and the
    # subscription page reading this differently is exactly the sort of thing
    # nobody notices until a customer asks why the trial button vanished.
    #
    # `provider == 'migration'` is excluded because a plan we handed out when
    # the pricing changed is not a plan they bought, and must not consume the
    # trial they have never taken.
    is_active_paid = bool(
        sub.status == "active"
        and not is_expired
        and sub.provider != "migration"
        and plans.rank(sub.plan_name) > plans.rank(plans.DEFAULT_PLAN)
    )
    dto.trial_available = not getattr(sub, "trial_used", False) and not is_active_paid

    # Auto-downgrade: an expired plan falls back to the entry plan so every
    # client (web, mobile, support tool) sees the same thing.
    # Same helper the subscription endpoint uses, so the header badge and the
    # Subscription page cannot disagree about which plan a clinic is on.
    effective = plans.effective_plan(sub.plan_name, sub.status, sub.current_end, now)
    dto.effective_plan = effective
    if is_expired and plans.key_of(clinic.subscription_plan) != effective:
        was_trial = bool(getattr(sub, "is_trial", False))
        clinic.subscription_plan = effective
        sub.status = 'expired'
        db.commit()
        dto.subscription_plan = effective
        # Fire a survey-trigger event once, when the downgrade actually happens.
        actor = str(owner.id) if owner else f"clinic_{clinic.id}"
        track_event(
            actor,
            EVENTS.TRIAL_ENDED if was_trial else EVENTS.SUBSCRIPTION_DOWNGRADED,
            {"from_trial": was_trial, "previous_plan": sub.plan_name},
            clinic_id=clinic.id,
        )

    dto.plan_name = sub.plan_name
    if sub.current_end:
        dto.plan_ends_at = sub.current_end.isoformat()
        dto.trial_days_remaining = max(0, (sub.current_end.date() - now.date()).days)

    # Keep the PostHog 'clinic' group properties fresh (B2B group analytics).
    group_identify("clinic", str(clinic.id), {
        "name": clinic.name,
        "plan": clinic.subscription_plan,
        "is_trial": bool(getattr(dto, "is_trial", False)),
        "country": getattr(clinic, "country", None),
    })
    return dto


@router.post(
    "/register",
    response_model=AuthResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account with email and password"
)
async def register_user(
    user_data: RegisterRequestDTO,
    auth_service = Depends(get_auth_service)
):
    """
    Register a new user account.

    Creates a user with the specified role and default permissions.
    """
    try:
        # Bound here so the token can record which device it belongs to, even
        # on the paths that never register one.
        device = None
        # Public self-signup always creates a clinic owner. Staff (doctors,
        # receptionists) are added by the owner via /clinic-users; letting
        # someone self-register as a non-owner leaves them with no clinic and
        # unable to onboard.
        registration_data = user_data.dict()
        registration_data["role"] = "clinic_owner"
        user = auth_service.create_user(registration_data)
        token = auth_service.create_jwt_token(user.id, device.id if device else None)

        notify(
            "molarplus_app_welcome", channel="email",
            to_email=user.email, to_name=getattr(user, 'first_name', '') or user.email,
            template_data={
                "owner_name": getattr(user, 'first_name', None) or user.email.split('@')[0],
                "clinic_name": "your clinic",
            }
        )

        return AuthResponseDTO(
            message="User registered successfully",
            user=UserResponseDTO.from_orm(user),
            token=token
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


def _get_clinic_for_user(db: Session, user) -> Optional[ClinicResponseDTO]:
    """Return clinic DTO (enriched with subscription info) if user has clinic_id, else None."""
    if not getattr(user, "clinic_id", None):
        return None
    clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
    return _enrich_clinic_dto(db, clinic) if clinic else None


def _seed_clinic_defaults(db: Session, clinic_id: int):
    """Seed wallet credit, default procedures, and clinical settings for a new clinic."""
    from models import TreatmentType, ClinicalSetting, NotificationPreference
    from core.wallet_service import credit as wallet_credit, WELCOME_CREDIT

    wallet_credit(db, clinic_id, WELCOME_CREDIT, "Welcome credit for a new clinic")

    # Platform summary rows are seeded so the preferences screen and the support
    # tool have something to show from day one. Weekly and monthly ship ON.
    #
    # The DAILY summary ships OFF, deliberately. It is a WhatsApp message to
    # every clinic owner every evening, paid for by us rather than deducted from
    # the clinic's wallet, which makes it the largest recurring notification
    # cost we carry and the one nobody asked for. A clinic that wants it turns
    # it on in Control Center -> Notifications -> Preferences, and only then
    # does daily_summary_broadcast_job pick that clinic up.
    summary_defaults = {
        "daily_summary": False,
        "molarplus_weekly_report_mk": True,
        "molarplus_monthly_report_mk": True,
    }
    for event_type, enabled_by_default in summary_defaults.items():
        existing = (
            db.query(NotificationPreference)
            .filter(
                NotificationPreference.clinic_id == clinic_id,
                NotificationPreference.event_type == event_type,
            )
            .first()
        )
        if not existing:
            db.add(NotificationPreference(
                clinic_id=clinic_id,
                event_type=event_type,
                channels=["whatsapp"],
                is_enabled=enabled_by_default,
            ))

    procedures = [
        ("Consultation", 200), ("X-Ray", 500), ("Tooth Extraction", 800),
        ("Dental Filling", 1000), ("Root Canal Treatment", 3500),
        ("Teeth Cleaning / Scaling", 1200), ("Tooth Whitening", 3000),
        ("Crown", 5000), ("Dental Bridge", 8000), ("Denture (Full)", 12000),
        ("Orthodontic Consultation", 500), ("Pit & Fissure Sealant", 600),
    ]
    for name, price in procedures:
        db.add(TreatmentType(clinic_id=clinic_id, name=name, price=float(price), is_active=True))

    defaults = {
        "complaint": [
            "Toothache", "Tooth Sensitivity", "Bleeding Gums", "Broken Tooth",
            "Bad Breath", "Jaw Pain", "Swelling", "Loose Tooth", "Pain on Chewing",
            "Tooth Discolouration",
        ],
        "medical-condition": [
            "Diabetes", "Hypertension", "Heart Disease", "Asthma",
            "Thyroid Disorder", "Blood Disorder", "Kidney Disease", "Liver Disease",
            "No Known Medical Condition",
        ],
        "advice": [
            "Brush twice daily with fluoride toothpaste", "Floss daily",
            "Avoid sugary and acidic foods", "Visit dentist every 6 months",
            "Avoid smoking and tobacco", "Use a soft-bristled toothbrush",
            "Rinse with antiseptic mouthwash", "Take medications as prescribed",
        ],
        "finding": [
            "Caries", "Gingivitis", "Chronic Periodontitis", "Calculus",
            "Deep Pocket", "Tooth Mobility", "Periapical Abscess", "Plaque",
            "Attrition", "Recession",
        ],
        "dental-history": [
            "Previous Extraction", "Previous Filling", "Previous Root Canal",
            "Previous Crown", "Previous Orthodontic Treatment",
            "No Previous Dental Treatment",
        ],
        "diagnosis": [
            "Dental Caries", "Gingivitis", "Chronic Periodontitis", "Pulpitis",
            "Periapical Abscess", "Dental Fluorosis", "Malocclusion",
            "Temporomandibular Disorder", "Oral Ulcer", "Cracked Tooth Syndrome",
        ],
        "allergy": [
            "Penicillin", "Amoxicillin", "Aspirin", "Ibuprofen",
            "Latex", "Local Anesthetic (Lignocaine)", "No Known Allergies",
        ],
        "current-medication": [
            "Metformin", "Amlodipine", "Atorvastatin", "Aspirin",
            "Lisinopril", "Warfarin", "Insulin", "No Current Medication",
        ],
        "additional-fee": [
            "Emergency Appointment Fee", "Late Cancellation Fee",
            "Report Generation Fee", "Home Visit Charge",
        ],
    }
    for category, names in defaults.items():
        for name in names:
            db.add(ClinicalSetting(clinic_id=clinic_id, category=category, name=name, is_active=True))
    db.commit()


@router.post(
    "/login",
    response_model=AuthResponseDTO,
    summary="User login",
    description="Authenticate user with email and password"
)
async def login_user(
    request: Request,
    login_data: LoginRequestDTO,
    auth_service=Depends(get_auth_service),
    db: Session = Depends(get_db),
):
    """
    Authenticate user with email and password.

    Returns JWT token, user information, and clinic details (if onboarded) on success.
    """
    try:
        # Bound here so the token can record which device it belongs to, even
        # on the paths that never register one.
        device = None
        # Trimmed, because a pasted address or an autofilled one arrives with a
        # trailing space often enough to matter. Case is handled in the lookup
        # itself (core.login_identifier) rather than here, so the address the
        # audit trail records is the one they actually typed.
        identifier = normalize_identifier(login_data.email)

        # Checked BEFORE the password, so a locked-out attempt costs a dict
        # lookup instead of a bcrypt verification. bcrypt is deliberately slow;
        # letting anybody spend that CPU at will is its own denial of service.
        cooling = throttle.check(identifier, client_ip(request))
        if cooling:
            seconds, reason = cooling
            raise HTTPException(
                status_code=429,
                detail=lockout_message(seconds, reason),
                headers={"Retry-After": str(seconds), "X-Retry-After-Seconds": str(seconds)},
            )

        user = auth_service.authenticate_user(identifier, login_data.password)

        if not user:
            throttle.record_failure(identifier, client_ip(request))
            # Recorded against the clinic the email belongs to, when there is
            # one, so an owner can see attempts on their own accounts. An
            # address that matches nobody is not logged at all: it would let
            # anyone write rows into an arbitrary clinic's audit trail.
            attempted = find_user_by_identifier(db, identifier)

            # A deactivated person and a wrong password are two different
            # problems with two different fixes, and answering both with
            # "Invalid credentials" sends someone who has been removed from the
            # clinic round the reset-password loop instead of to their owner.
            # Only said once the password checks out, so it cannot be used to
            # probe which accounts exist.
            if (
                attempted
                and not attempted.is_active
                and attempted.password_hash
                and verify_password(login_data.password, attempted.password_hash)
            ):
                # LOGIN_BLOCKED, not LOGIN_FAILED — nothing about their
                # credentials failed. The owner reading this trail should see a
                # deactivated person still trying to get in, not a wrong
                # password that never happened.
                record_audit(
                    db, None, LOGIN_BLOCKED,
                    "Sign-in blocked: this account is deactivated",
                    request=request, entity_type='user', entity_id=attempted.id,
                    clinic_id=attempted.clinic_id, actor_name=attempted.name or identifier,
                    commit=True,
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This account has been deactivated. Ask your clinic owner to restore your access.",
                )

            if attempted:
                record_audit(
                    db, None, LOGIN_FAILED,
                    f"Failed sign-in attempt for {identifier}",
                    request=request, entity_type='user', entity_id=attempted.id,
                    clinic_id=attempted.clinic_id, actor_name=attempted.name or identifier,
                    commit=True,
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        # Register device if device info provided, then honour its access rules.
        if login_data.device:
            device_info = auth_service.detect_device_info(request, login_data.device)
            device = auth_service.register_device(user.id, device_info)
            blocked = auth_service.device_block_reason(device, device_info["device_type"])
            if blocked:
                record_audit(
                    db, user, LOGIN_BLOCKED,
                    f"Sign-in blocked on {device_info.get('device_type') or 'a device'}: {blocked}",
                    request=request, entity_type='user', entity_id=user.id, commit=True,
                )
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=blocked)

        # Cleared only once the device checks above have also passed, so a
        # blocked device cannot be used to keep an account's counter at zero.
        throttle.record_success(identifier, client_ip(request))

        record_audit(
            db, user, LOGIN_SUCCEEDED,
            _signed_in_from(login_data),
            request=request, entity_type='user', entity_id=user.id, commit=True,
        )

        token = auth_service.create_jwt_token(user.id, device.id if device else None)
        
        # Load clinics for the user
        user_clinics_list = (
            db.query(Clinic)
            .join(User.clinics)
            .filter(User.id == user.id)
            .all()
        )
        
        user_dto = UserResponseDTO.from_orm(user)
        user_dto.clinics = [_enrich_clinic_dto(db, c) for c in user_clinics_list]
        
        clinic = _get_clinic_for_user(db, user)

        return AuthResponseDTO(
            message="Login successful",
            user=user_dto,
            token=token,
            clinic=clinic
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.post(
    "/oauth",
    response_model=AuthResponseDTO,
    summary="OAuth login",
    description="Authenticate user with OAuth provider (Google, etc.)"
)
async def oauth_login(
    request: Request,
    oauth_data: OAuthRequestDTO,
    auth_service=Depends(get_auth_service),
    db: Session = Depends(get_db),
):
    """
    Handle OAuth authentication flow.

    Verifies the OAuth token and creates/logs in the user.
    Returns user and clinic details (if onboarded) on success.
    """
    try:
        # Bound here so the token can record which device it belongs to, even
        # on the paths that never register one.
        device = None
        user = auth_service.handle_oauth_login(
            oauth_data.id_token,
            oauth_data.device,
            getattr(oauth_data, 'role', None)
        )

        if oauth_data.device:
            device_info = auth_service.detect_device_info(request, oauth_data.device.dict() if hasattr(oauth_data.device, 'dict') else oauth_data.device)
            device = auth_service.register_device(user.id, device_info)
            blocked = auth_service.device_block_reason(device, device_info["device_type"])
            if blocked:
                record_audit(
                    db, user, LOGIN_BLOCKED,
                    f"Sign-in blocked on {device_info.get('device_type') or 'a device'}: {blocked}",
                    request=request, entity_type='user', entity_id=user.id, commit=True,
                )
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=blocked)

        # Load clinics for the user
        user_clinics_list = (
            db.query(Clinic)
            .join(User.clinics)
            .filter(User.id == user.id)
            .all()
        )
        
        user_dto = UserResponseDTO.from_orm(user)
        user_dto.clinics = [_enrich_clinic_dto(db, c) for c in user_clinics_list]
        
        record_audit(
            db, user, LOGIN_SUCCEEDED,
            _signed_in_from(oauth_data),
            request=request, entity_type='user', entity_id=user.id, commit=True,
        )

        token = auth_service.create_jwt_token(user.id, device.id if device else None)
        clinic = _get_clinic_for_user(db, user)

        return AuthResponseDTO(
            message="OAuth login successful",
            user=user_dto,
            token=token,
            clinic=clinic
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except HTTPException:
        # The refusals this handler raises on purpose — a revoked device, a
        # switched-off platform — are answers, not malfunctions. Without this
        # they fell through to the catch-all below and reached the user as
        # "something went wrong on our end", which told them nothing.
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth login failed: {str(e)}"
        )


@router.post(
    "/oauth/code",
    response_model=AuthResponseDTO,
    summary="OAuth login (desktop: exchange code)",
    description="Exchange Google OAuth code for JWT. Used by desktop app when using system browser flow."
)
async def oauth_code_login(
    request: Request,
    oauth_data: OAuthCodeRequestDTO,
    auth_service=Depends(get_auth_service),
    db: Session = Depends(get_db),
):
    """
    Exchange authorization code with Google, verify id_token, then same as /oauth.
    Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (same OAuth client as frontend).
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("VITE_GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)"
        )
    try:
        # Bound here so the token can record which device it belongs to, even
        # on the paths that never register one.
        device = None
        resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": oauth_data.code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": oauth_data.redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        id_token = data.get("id_token")
        if not id_token:
            raise ValueError("Google did not return an id_token")
        user = auth_service.handle_oauth_login(
            id_token,
            oauth_data.device,
            getattr(oauth_data, "role", None),
        )
        if oauth_data.device:
            device_info = auth_service.detect_device_info(
                request,
                oauth_data.device if isinstance(oauth_data.device, dict) else oauth_data.device.dict(),
            )
            device = auth_service.register_device(user.id, device_info)
            blocked = auth_service.device_block_reason(device, device_info["device_type"])
            if blocked:
                record_audit(
                    db, user, LOGIN_BLOCKED,
                    f"Sign-in blocked on {device_info.get('device_type') or 'a device'}: {blocked}",
                    request=request, entity_type='user', entity_id=user.id, commit=True,
                )
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=blocked)
        record_audit(
            db, user, LOGIN_SUCCEEDED,
            _signed_in_from(oauth_data),
            request=request, entity_type='user', entity_id=user.id, commit=True,
        )

        token = auth_service.create_jwt_token(user.id, device.id if device else None)
        
        # Load clinics for the user
        user_clinics_list = (
            db.query(Clinic)
            .join(User.clinics)
            .filter(User.id == user.id)
            .all()
        )
        
        user_dto = UserResponseDTO.from_orm(user)
        user_dto.clinics = [_enrich_clinic_dto(db, c) for c in user_clinics_list]
        
        clinic = _get_clinic_for_user(db, user)
        return AuthResponseDTO(
            message="OAuth login successful",
            user=user_dto,
            token=token,
            clinic=clinic,
        )
    except requests.RequestException as e:
        err_detail = str(e)
        if hasattr(e, "response") and e.response is not None:
            try:
                err_detail = e.response.json().get("error_description", e.response.text)
            except Exception:
                err_detail = getattr(e.response, "text", None) or err_detail
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google token exchange failed: {err_detail}",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )
    except HTTPException:
        # Same as /oauth above: the device block and the Google token-exchange
        # failure are both deliberate HTTPExceptions raised inside this try.
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth code login failed: {str(e)}",
        )


@router.get(
    "/me",
    summary="Get current user",
    description="Retrieve information about the currently authenticated user including clinic details"
)
async def get_current_user(
    request: Request,
    auth_service=Depends(get_auth_service),
    db: Session = Depends(get_db),
):
    """
    Get information about the currently authenticated user.
    Includes clinic details when the user has completed onboarding (has clinic_id).

    Requires valid JWT token in Authorization header.
    """
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header"
            )

        token = auth_header.split(" ")[1]
        user = auth_service.validate_token(token)

        if not user:
            # validate_token collapses "bad token" and "perfectly good token,
            # deactivated person" into the same None. This message is what the
            # signed-out screen shows, so answering "invalid token" sends a
            # deactivated nurse off to re-type a password that cannot work.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_signed_out_reason(db, token),
            )

        # Re-load user with clinic in this session so clinic is always available when user has clinic_id
        user_with_clinic = (
            db.query(User)
            .options(joinedload(User.active_clinic))
            .filter(User.id == user.id, User.is_active == True)
            .first()
        )
        if not user_with_clinic:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your account is no longer active at this clinic. Please contact your clinic owner."
            )
        user = user_with_clinic

        # This endpoint decodes the token itself rather than going through
        # get_current_user, so the device check there does not cover it. It is
        # the call the app makes on launch to decide whether it is still signed
        # in — so without this, a blocked device booted straight into the app
        # and only discovered it was locked out on the first screen that loaded
        # data. Same rule as get_current_user: a missing device row is fine
        # ("Remove" means re-enrol), only an explicit block ends the session.
        try:
            device_id = jwt.decode(
                token, get_jwt_secret(), algorithms=["HS256"]
            ).get("did")
        except Exception:
            device_id = None
        if device_id is not None:
            device = db.query(UserDevice).filter(UserDevice.id == device_id).first()
            if device is not None and not device.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="This device has been blocked. Please contact your clinic owner.",
                )

        user_dto = UserResponseDTO.from_orm(user)
        
        # Load clinics for the user
        user_clinics_list = (
            db.query(Clinic)
            .join(User.clinics)
            .filter(User.id == user.id)
            .all()
        )
        user_dto.clinics = [_enrich_clinic_dto(db, c) for c in user_clinics_list]
        
        clinic_info = None
        if user.clinic_id and hasattr(user, "active_clinic") and user.active_clinic:
            clinic_info = _enrich_clinic_dto(db, user.active_clinic).model_dump()
        elif user.clinic_id:
            clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
            if clinic:
                clinic_info = _enrich_clinic_dto(db, clinic).model_dump()
        
        result = user_dto.model_dump()
        result["clinic"] = clinic_info
        # Google/OAuth accounts carry a Firebase-backed supabase_user_id;
        # password/username accounts don't (or use a "local_" placeholder).
        result["is_google_account"] = bool(
            user.supabase_user_id and not user.supabase_user_id.startswith("local_")
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user info: {str(e)}"
        )


@router.patch("/me/signature", summary="Update user signature")
async def update_signature(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
):
    """Save (or clear) the current user's signature image.

    Accepts a `data:image/(png|jpeg);base64,...` URI. Validates by re-decoding
    through Pillow — rejects polyglots, SVG (script vector), oversize blobs,
    and non-image bytes. Output is normalised to a clean PNG data URI before
    storage so the renderer can trust whatever's in the column.
    """
    from core.auth_utils import get_current_user as _get_user
    from models import User
    user = _get_user(request, db)

    raw = payload.get("signature_url")
    # Allow clearing
    if raw is None or raw == "":
        db.query(User).filter(User.id == user.id).update({"signature_url": None})
        db.commit()
        return {"status": "ok", "signature_url": None}

    if not isinstance(raw, str) or not raw.startswith("data:"):
        raise HTTPException(status_code=400, detail="signature_url must be a data: URI")

    # Reject SVG outright — WeasyPrint executes SVG scripts in some configs.
    if raw.startswith("data:image/svg") or "svg+xml" in raw[:60].lower():
        raise HTTPException(status_code=400, detail="SVG signatures are not supported")

    # Cap pre-decode payload — base64 inflates by ~33%, so 1 MB string ≈ 750 KB binary.
    if len(raw) > 1_400_000:
        raise HTTPException(status_code=413, detail="signature too large (max ~1 MB)")

    # Pull the base64 part out of the data URI
    try:
        header, b64 = raw.split(",", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="malformed data URI")
    if "base64" not in header:
        raise HTTPException(status_code=400, detail="signature_url must be base64-encoded")

    import base64 as _b64
    import io as _io
    try:
        decoded = _b64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid base64")

    if len(decoded) > 1_000_000:
        raise HTTPException(status_code=413, detail="signature too large (max 1 MB after decode)")

    try:
        from PIL import Image, UnidentifiedImageError
    except ImportError:
        raise HTTPException(status_code=500, detail="image processing unavailable on server")

    try:
        img = Image.open(_io.BytesIO(decoded))
        img.verify()
        img = Image.open(_io.BytesIO(decoded))  # re-open: verify() invalidates
    except (UnidentifiedImageError, Exception):
        raise HTTPException(status_code=400, detail="not a valid image")

    if img.format not in {"PNG", "JPEG"}:
        raise HTTPException(status_code=400, detail=f"unsupported format {img.format} — use PNG or JPEG")
    if img.width > 1024 or img.height > 1024:
        raise HTTPException(status_code=400, detail="signature dimensions exceed 1024px")

    # Downscale to a print-appropriate size (signatures render at ~120-160 px in PDFs).
    if max(img.width, img.height) > 400:
        img.thumbnail((400, 400), Image.LANCZOS)

    # Normalise to PNG so we control what's stored. Preserve alpha if present.
    if img.mode not in ("RGBA", "LA", "RGB"):
        img = img.convert("RGBA")
    out = _io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    clean_b64 = _b64.b64encode(out.getvalue()).decode("ascii")
    clean_uri = f"data:image/png;base64,{clean_b64}"

    db.query(User).filter(User.id == user.id).update({"signature_url": clean_uri})
    db.commit()
    return {"status": "ok", "signature_url": clean_uri}


@router.patch("/me", summary="Update the current user's profile (name, phone)")
async def update_profile(
    payload: UpdateProfileDTO,
    request: Request,
    db: Session = Depends(get_db),
):
    """Self-service profile edit. Only updates the fields provided; never touches
    role, email, clinic, or password. `name` is kept in sync with first/last."""
    from core.auth_utils import get_current_user as _get_user
    user = _get_user(request, db)

    updates = {}
    data = payload.model_dump(exclude_unset=True)
    if "first_name" in data and data["first_name"] is not None:
        updates["first_name"] = data["first_name"].strip()
    if "last_name" in data and data["last_name"] is not None:
        updates["last_name"] = data["last_name"].strip()
    if "phone" in data:
        phone = (data["phone"] or "").strip()
        updates["phone"] = phone or None

    if not updates:
        raise HTTPException(status_code=400, detail="No profile fields to update")

    # Keep the denormalised full name in sync when either part changes.
    if "first_name" in updates or "last_name" in updates:
        new_first = updates.get("first_name", user.first_name)
        new_last = updates.get("last_name", user.last_name)
        updates["name"] = f"{new_first} {new_last}".strip()

    db.query(User).filter(User.id == user.id).update(updates)
    db.commit()
    refreshed = db.query(User).filter(User.id == user.id).first()
    return {
        "status": "ok",
        "first_name": refreshed.first_name,
        "last_name": refreshed.last_name,
        "name": refreshed.name,
        "phone": refreshed.phone,
    }


@router.patch("/me/avatar", summary="Update the current user's profile photo")
async def update_avatar(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
):
    """Save (or clear) the current user's avatar. Accepts a
    `data:image/(png|jpeg);base64,...` URI, validated + re-encoded through Pillow
    (same hardening as the signature endpoint) and normalised to a square-ish PNG."""
    from core.auth_utils import get_current_user as _get_user
    user = _get_user(request, db)

    raw = payload.get("avatar_url")
    if raw is None or raw == "":
        db.query(User).filter(User.id == user.id).update({"avatar_url": None})
        db.commit()
        return {"status": "ok", "avatar_url": None}

    if not isinstance(raw, str) or not raw.startswith("data:"):
        raise HTTPException(status_code=400, detail="avatar_url must be a data: URI")
    if raw.startswith("data:image/svg") or "svg+xml" in raw[:60].lower():
        raise HTTPException(status_code=400, detail="SVG avatars are not supported")
    if len(raw) > 4_000_000:
        raise HTTPException(status_code=413, detail="avatar too large (max ~3 MB)")

    try:
        header, b64 = raw.split(",", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="malformed data URI")
    if "base64" not in header:
        raise HTTPException(status_code=400, detail="avatar_url must be base64-encoded")

    import base64 as _b64
    import io as _io
    try:
        decoded = _b64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid base64")
    if len(decoded) > 3_000_000:
        raise HTTPException(status_code=413, detail="avatar too large (max 3 MB after decode)")

    try:
        from PIL import Image, UnidentifiedImageError
    except ImportError:
        raise HTTPException(status_code=500, detail="image processing unavailable on server")

    try:
        img = Image.open(_io.BytesIO(decoded))
        img.verify()
        img = Image.open(_io.BytesIO(decoded))  # re-open: verify() invalidates
    except (UnidentifiedImageError, Exception):
        raise HTTPException(status_code=400, detail="not a valid image")

    if img.format not in {"PNG", "JPEG"}:
        raise HTTPException(status_code=400, detail=f"unsupported format {img.format} — use PNG or JPEG")

    # Downscale to an avatar-appropriate size; store as a compact PNG.
    if max(img.width, img.height) > 256:
        img.thumbnail((256, 256), Image.LANCZOS)
    if img.mode not in ("RGBA", "LA", "RGB"):
        img = img.convert("RGB")
    out = _io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    clean_b64 = _b64.b64encode(out.getvalue()).decode("ascii")
    clean_uri = f"data:image/png;base64,{clean_b64}"

    db.query(User).filter(User.id == user.id).update({"avatar_url": clean_uri})
    db.commit()
    return {"status": "ok", "avatar_url": clean_uri}


@router.post(
    "/change-password",
    response_model=SuccessResponseDTO,
    summary="Change password",
    description="Change the current user's password"
)
async def change_password(
    password_data: ChangePasswordRequestDTO,
    request: Request,
    db: Session = Depends(get_db),
    auth_service = Depends(get_auth_service)
):
    """
    Change the current user's password.

    Requires current password for verification.
    """
    try:
        # Get current user from token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header"
            )

        token = auth_header.split(" ")[1]
        user = auth_service.validate_token(token)

        if not user:
            # validate_token collapses "bad token" and "perfectly good token,
            # deactivated person" into the same None. This message is what the
            # signed-out screen shows, so answering "invalid token" sends a
            # deactivated nurse off to re-type a password that cannot work.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_signed_out_reason(db, token),
            )

        # Change password
        success = auth_service.update_password(
            user.id,
            password_data.current_password,
            password_data.new_password
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update password"
            )

        return SuccessResponseDTO(
            message="Password changed successfully"
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password change failed: {str(e)}"
        )


@router.post(
    "/logout",
    response_model=SuccessResponseDTO,
    summary="User logout",
    description="Log out the current user (client-side token cleanup)"
)
async def logout_user(
    request: Request,
    db: Session = Depends(get_db),
    # Aliased because this module has its own get_current_user route handler
    # further up, which shadows the dependency and returns a dict rather than a
    # User. The rest of the file does the same.
    current_user: User = Depends(_current_user_dep),
):
    """
    Log out the current user.

    The token is discarded client-side; this endpoint exists to record that it
    happened. Signing out closes the window in which a session could be used,
    so pairing it with the sign-in entry is what lets someone reconstruct how
    long an account was actually active.

    Authenticated now, where it previously took no user at all: without that
    there was nobody to attribute the entry to.
    """
    record_audit(
        db, current_user, LOGOUT, "Signed out",
        request=request, entity_type='user', entity_id=current_user.id,
        commit=True,
    )
    return SuccessResponseDTO(
        message="Logged out successfully"
    )


@router.post(
    "/onboarding",
    summary="Complete clinic onboarding",
    description="Create clinic and link to current user"
)
async def complete_onboarding(
    request: Request,
    auth_service = Depends(get_auth_service),
    user_service = Depends(get_user_service),
    db: Session = Depends(get_db),
):
    """
    Complete onboarding for clinic owners - creates clinic and links user.
    Requires valid JWT token in Authorization header.
    """
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header"
            )

        token = auth_header.split(" ")[1]
        user = auth_service.validate_token(token)

        if not user:
            # validate_token collapses "bad token" and "perfectly good token,
            # deactivated person" into the same None. This message is what the
            # signed-out screen shows, so answering "invalid token" sends a
            # deactivated nurse off to re-type a password that cannot work.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_signed_out_reason(db, token),
            )

        data = await request.json()

        if not data.get("clinic_name"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clinic name is required"
            )

        # Number of chairs comes in as a string from the form; clamp to a sane integer.
        try:
            chairs = int(data.get("number_of_chairs", 1) or 1)
        except (TypeError, ValueError):
            chairs = 1
        chairs = max(1, min(chairs, 50))

        # Resolve locale from country code (defaults to India)
        from core.countries import get_country_config
        country_code = (data.get("country") or "IN").upper()
        country_cfg = get_country_config(country_code)

        clinic_data = {
            "name": data.get("clinic_name"),
            "address": data.get("clinic_address", ""),
            "phone": data.get("clinic_phone", ""),
            "email": data.get("clinic_email", user.email),
            "specialization": data.get("specialization", "dental"),
            "number_of_chairs": chairs,
            # Not a literal. This said "free" for a year after the free tier was
            # retired, and because LEGACY_ALIASES maps free->plus the clinic then
            # read as Plus everywhere while owning no subscription row at all.
            # user_service.complete_onboarding overwrites this with the same
            # value when it provisions the row; it is set here so the INSERT is
            # never briefly wrong.
            "subscription_plan": plans.stored_name(plan_bootstrap.SIGNUP_PLAN),
            "clinic_label": "main_branch",
            "referred_by_code": data.get("referred_by_code"),
            "country": country_code,
            "currency_code": country_cfg["currency_code"],
            "currency_symbol": country_cfg["currency_symbol"],
            "timezone": country_cfg["timezone"],
            "tax_label": country_cfg["tax_label"],
        }

        # Signup now finds the address on a map instead of asking for it as a
        # line of text, so the city, state, postcode and pin come back for free.
        # Every key below is an existing nullable column, and each is added only
        # when the client actually sends it: an older bundle, or somebody who
        # typed the address by hand, inserts exactly what it always did.
        #
        # Worth keeping even though nothing reads the pin yet — Team → Location
        # asks owners to drop the same pin a second time for the attendance
        # geofence, and this is the one moment they have already found it.
        for _key, _limit in (
            ("city", 120), ("state", 120), ("postal_code", 20), ("google_place_id", 255),
        ):
            _value = str(data.get(_key) or "").strip()
            if _value:
                clinic_data[_key] = _value[:_limit]

        for _key in ("latitude", "longitude"):
            _raw = data.get(_key)
            if _raw in (None, ""):
                continue
            try:
                clinic_data[_key] = float(_raw)
            except (TypeError, ValueError):
                # A pin we cannot parse is not worth failing a signup over.
                pass

        result = user_service.complete_onboarding(user.id, clinic_data)
        clinic = result["clinic"]
        platform_notifications = PlatformNotificationService(db)

        # Create default scan types if provided
        scan_types = data.get("scan_types", [])
        if scan_types:
            from models import TreatmentType
            for scan_type_data in scan_types:
                if scan_type_data.get("name") and scan_type_data.get("price"):
                    treatment_type = TreatmentType(
                        clinic_id=clinic.id,
                        name=scan_type_data["name"],
                        price=float(scan_type_data["price"]),
                        is_active=True
                    )
                    db.add(treatment_type)
            db.commit()

        # Seed defaults (wallet credit, procedures, clinical settings)
        try:
            _seed_clinic_defaults(db, clinic.id)
        except Exception as seed_err:
            print(f"Non-fatal: failed to seed clinic defaults: {seed_err}")

        try:
            platform_notifications.send_welcome_notifications(clinic, result["user"])
        except Exception as notification_error:
            print(f"Failed to queue onboarding notifications: {notification_error}")

        return {
            "message": "Onboarding completed successfully",
            "user": UserResponseDTO.from_orm(result["user"]),
            "clinic": _enrich_clinic_dto(db, clinic)
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        try:
            user_service.user_repo.db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Onboarding failed: {str(e)}"
        )


@router.post(
    "/refresh-token",
    summary="Refresh JWT token",
    description="Generate a new JWT token for the authenticated user"
)
async def refresh_token(
    request: Request,
    db: Session = Depends(get_db),
    auth_service = Depends(get_auth_service)
):
    """
    Refresh the JWT token for the authenticated user.

    Generates a new token with updated expiration time.
    """
    try:
        # Bound here so the token can record which device it belongs to, even
        # on the paths that never register one.
        device = None
        # Get current user from token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header"
            )

        token = auth_header.split(" ")[1]
        user = auth_service.validate_token(token)

        if not user:
            # validate_token collapses "bad token" and "perfectly good token,
            # deactivated person" into the same None. This message is what the
            # signed-out screen shows, so answering "invalid token" sends a
            # deactivated nurse off to re-type a password that cannot work.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_signed_out_reason(db, token),
            )

        # Generate new token
        new_token = auth_service.create_jwt_token(user.id, device.id if device else None)

        return {
            "message": "Token refreshed successfully",
            "token": new_token
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token refresh failed: {str(e)}"
        )

@router.post(
    "/switch-clinic/{clinic_id}",
    response_model=AuthResponseDTO,
    summary="Switch active clinic",
    description="Switch the current user's active clinic context"
)
async def switch_clinic(
    clinic_id: int,
    request: Request,
    auth_service = Depends(get_auth_service),
    db: Session = Depends(get_db)
):
    """
    Switch the active clinic for the current user.
    Verifies that the user has access to the requested clinic.
    """
    try:
        # Get current user from token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header"
            )

        token = auth_header.split(" ")[1]
        user_info = auth_service.validate_token(token)

        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )

        # Get full user from DB
        user = db.query(User).filter(User.id == user_info.id).first()
        if not user:
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Verify clinic access
        clinic = db.query(Clinic).join(User.clinics).filter(User.id == user.id, Clinic.id == clinic_id).first()
        if not clinic:
            # Check if user is owner of the clinic directly (legacy check or backup)
            clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
            # In a real multi-clinic system, we should rely on user_clinics association
            # If not in user_clinics, check if they are the one who created it or similar
            if not clinic:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this clinic"
                )

        # Update active clinic
        user.clinic_id = clinic_id
        db.commit()
        db.refresh(user)

        # Prepare response
        user_clinics_list = (
            db.query(Clinic)
            .join(User.clinics)
            .filter(User.id == user.id)
            .all()
        )
        
        user_dto = UserResponseDTO.from_orm(user)
        user_dto.clinics = [_enrich_clinic_dto(db, c) for c in user_clinics_list]
        
        return AuthResponseDTO(
            message=f"Switched to clinic: {clinic.name}",
            user=user_dto,
            token=token,
            clinic=_enrich_clinic_dto(db, clinic)
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Clinic switch failed: {str(e)}"
        )


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class AdoptPasswordRequest(BaseModel):
    password: str


@router.post("/adopt-password", summary="Store a password for an account that has none here")
def adopt_password(
    payload: AdoptPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    auth_service=Depends(get_auth_service),
):
    """Close the gap between the two places a password can live.

    Signing up on the web writes a password_hash on our own users row. Signing
    up in the mobile app creates a FIREBASE password and syncs the backend
    through /auth/oauth, which leaves password_hash null. That second group
    could not sign in on the web at all, and /forgot-password had nothing to
    reset for them, so it skipped them silently and still said "we've sent a
    link".

    Both clients now call this immediately after a successful Firebase password
    sign-in, and mobile calls it on signup too. The account gets a password on
    our side the first time its owner uses it, so from then on the ordinary
    login path works everywhere and password reset has something to reset.
    Nobody is emailed and nobody is asked to do anything.

    Safe because of what it refuses. The caller is already authenticated for
    this account, which means Firebase has just checked this exact password. And
    an account that ALREADY has a password_hash is left untouched: overwriting
    one without knowing the old one is a takeover, not a migration. Once the
    second store is empty this endpoint stops doing anything and can go.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )

    token = auth_header.split(" ")[1]
    user = auth_service.validate_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_signed_out_reason(db, token),
        )

    if user.password_hash:
        # Already has one. Not an error: both clients call this on every
        # Firebase sign-in, so the second time round there is simply nothing
        # left to do.
        return {"adopted": False, "reason": "already_set"}

    if not payload.password or len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters.",
        )

    user.password_hash = auth_service.hash_password(payload.password)
    user.updated_at = _dt.utcnow()
    db.commit()
    return {"adopted": True}


@router.post("/forgot-password", summary="Request a password reset link")
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
    auth_service=Depends(get_auth_service),
):
    """Email a time-limited reset link. From OUR sender, for EVERY account.

    Both halves of that sentence used to be false, and they were the same bug.

    This route refused any account with no password_hash, on the reasoning that
    a Google account has no password to reset. But "no password on our side"
    also describes every clinic that signed up in the mobile app, where the
    password lives in Firebase. So the largest group needing a reset was the one
    group this endpoint would not serve, and it answered them with the same
    cheerful "we've sent a link" as everybody else while sending nothing.

    The clients worked around that by asking Firebase to send the mail instead.
    Firebase sends from noreply@<project>.firebaseapp.com, a Google-owned domain
    with no SPF or DKIM alignment to molarplus.com and no relationship to any
    other mail this product sends, so those messages landed in spam. A password
    reset in the spam folder is the same as no password reset.

    So: no account is skipped. If the address matches somebody, they get a link
    from our own authenticated Zoho sender. For an account with no password on
    our side the link SETS one, which is both the thing they were asking for and
    the thing that migrates them off the second password store for good.

    Letting a Google-only account set a password is not a new trust decision.
    Proving control of the inbox is exactly what a reset has always proved, and
    the link only ever goes to the address already on the account.

    Always returns a generic success message regardless of whether the email
    exists or how the account signed up — this avoids leaking which emails are
    registered (account enumeration)."""
    # Who it will come from and what it is called, handed to the client so the
    # "not in your inbox?" panel can name both. Somebody scanning a full spam
    # folder is searching, and the sender and the subject are the only two
    # things they can search on. Carried on the generic response, which reveals
    # nothing: this is the same answer whether or not the address is registered,
    # and both values are printed on every email we have ever sent anyway.
    generic = {
        "message": "If an account with that email exists, we've sent a password reset link.",
        "from_email": os.getenv("ZEPTO_PLATFORM_FROM_EMAIL") or "clinic@molarplus.com",
        "subject": "Reset your MolarPlus password",
    }

    email = normalize_email(payload.email)
    if not email:
        return generic

    user = find_user_by_email(db, email)

    if user:
        token = auth_service.create_password_reset_token(user)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        reset_url = f"{frontend_url}/reset-password?token={token}"

        # Through Nexus, like every other email this product sends.
        #
        # This used to call EmailService directly, which talks to Zoho. In
        # production that could never work: no ZOHO_* variables reach the
        # backend container, so the call failed with "ZOHO_FROM_EMAIL
        # environment variable not set" every single time, the exception was
        # swallowed, and the customer was told a link was on its way. Reset mail
        # was not landing in spam, it was never being sent at all. The staff
        # invitation email had the same defect and is now on Nexus too.
        #
        # Nexus owns ZeptoMail and sends as the platform sender on our own
        # domain, which is also what keeps this out of the spam folder rather
        # than arriving from an unrelated one.
        #
        # Called synchronously rather than through the fire-and-forget notify()
        # helper for the same reason _deliver_otp is: this screen has just
        # promised somebody an email, so whether it actually left the building
        # is worth knowing. Failures are logged and never surfaced, because the
        # answer has to look identical whether or not the address is registered.
        try:
            resp = requests.post(
                f"{os.getenv('NEXUS_SERVICES_URL', 'http://localhost:8001')}"
                f"/api/v1/notifications/send-event",
                json={
                    "event_type": "password_reset",
                    "channel": "email",
                    "to_email": user.email,
                    "to_name": user.name or "",
                    "template_data": {
                        "reset_url": reset_url,
                        "user_name": user.name or "",
                        "expires_in_minutes": 60,
                    },
                },
                timeout=10,
            )
            if resp.status_code >= 400:
                logger.error(
                    "[forgot-password] Nexus refused the reset email for %s: %s %s",
                    email, resp.status_code, resp.text[:300],
                )
        except Exception:
            logger.exception("[forgot-password] could not reach Nexus for %s", email)

    return generic


@router.post("/reset-password", summary="Set a new password using a reset token")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    auth_service=Depends(get_auth_service),
):
    """Validate the reset token and set the new password."""
    if not payload.new_password or len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user_id = auth_service.verify_password_reset_token(payload.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    user.password_hash = auth_service.hash_password(payload.new_password)
    user.updated_at = _dt.utcnow()
    db.commit()

    return {"message": "Your password has been reset. You can now sign in with your new password."}


@router.post("/account-preview", summary="Look up an account by email for the forgot-password confirmation step")
def account_preview(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Return minimal account info so the forgot-password flow can confirm the
    right account (name + clinic) before sending a reset link.

    NOTE: unlike /forgot-password, this intentionally reveals whether an email
    is registered (account enumeration) so the user gets a clear confirmation —
    a deliberate product decision for the in-app reset UX.
    """
    email = normalize_email(payload.email)
    if not email:
        return {"found": False}

    user = find_user_by_email(db, email)
    if not user:
        return {"found": False}

    clinic_name = None
    if user.clinic_id:
        clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
        clinic_name = clinic.name if clinic else None

    return {
        "found": True,
        "name": user.name,
        "clinic_name": clinic_name,
        # Google-only accounts have no password and can't use email reset.
        "has_password": bool(user.password_hash),
    }
