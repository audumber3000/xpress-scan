"""
Clinic routes using clean architecture
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from typing import List, Optional
from sqlalchemy.orm import Session
from core.dtos import (
    ClinicCreateDTO,
    ClinicUpdateDTO,
    ClinicResponseDTO,
    PaginatedResponseDTO,
    SuccessResponseDTO,
    ErrorResponseDTO
)
from core.dependencies import get_clinic_service
from core.auth_utils import get_current_user, require_role
from core.nexus_notify import notify
from database import get_db
from models import Clinic, User, user_clinics, generate_clinic_code, Subscription
from sqlalchemy import select, func
import datetime
from core.audit import record_audit, CLINIC_UPDATED
from core import plans

router = APIRouter()


def _ensure_clinic_access(current_user: User, clinic_id: int) -> None:
    """
    Deny-by-default access to a clinic addressed by id.

    Access is decided by *membership* (the user_clinics association), never by
    role alone. The previous checks treated "is a clinic_owner" as sufficient
    for any clinic_id, which let an owner of one business read, update and
    deactivate another business's clinic.

    Note the deliberate exception to this rule is `/{clinic_id}/branding`, which
    is public by design but returns only a narrow, safe slice.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    if current_user.clinic_id == clinic_id:
        return
    if any(c.id == clinic_id for c in (current_user.clinics or [])):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You don't have access to this clinic",
    )


@router.get("/countries")
async def list_countries():
    """Return list of supported countries for signup dropdown (public, no auth)."""
    from core.countries import get_all_countries
    return get_all_countries()


@router.get("/currencies")
async def list_currencies():
    """Currencies for the clinic's Taxation settings (public, no auth).

    Separate from /countries on purpose: a clinic can bill in a currency its
    country doesn't issue. Lebanese practices quoting in USD are the common
    case, and forcing the country to "US" to reach USD would drag the clinic's
    timezone to America/New_York with it.
    """
    from core.countries import get_all_currencies
    return get_all_currencies()


@router.post(
    "/owner/add",
    response_model=ClinicResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Owner adds a new branch clinic",
    description="Creates a new clinic and links it to the authenticated clinic owner's account"
)
async def owner_add_clinic(
    clinic_data: ClinicCreateDTO,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("clinic_owner"))
):
    """
    Allows a clinic_owner to create a new branch under their account.
    The new clinic gets its own unique clinic_code and is linked to the owner
    via the user_clinics association table.
    """
    try:
        # Enforce 5-clinic limit per owner
        clinic_count = db.execute(
            select(func.count()).select_from(user_clinics).where(
                user_clinics.c.user_id == current_user.id,
                user_clinics.c.role == 'clinic_owner',
                user_clinics.c.is_active == True,
            )
        ).scalar() or 0
        if clinic_count >= 5:
            raise HTTPException(
                status_code=400,
                detail="You have reached the maximum of 5 clinics. Contact support to increase this limit."
            )

        # Branches are what separates the plans. Plus runs one clinic; Pro runs
        # up to five; Growth is unlimited. (The first clinic is created during
        # onboarding, never through this endpoint, so any owner who already has
        # >= 1 clinic here is trying to go multi-branch.)
        #
        # The plan's own branch cap is checked as well as the flat 5 above,
        # because they answer different questions: the 5 is a platform ceiling
        # on any one owner, this is what the customer actually bought.
        owner_sub = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
        current_plan = owner_sub.plan_name if (owner_sub and owner_sub.status == 'active') else None
        plan_label = plans.label(current_plan)

        if clinic_count >= 1 and not plans.allows_branches(current_plan):
            raise HTTPException(
                status_code=403,
                detail=(
                    f"{plan_label} covers one clinic location. "
                    "Upgrade to Pro to run up to five branches from one account."
                ),
            )

        allowed = plans.max_branches(current_plan)
        if allowed is not None and clinic_count >= allowed:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"{plan_label} covers up to {allowed} branches and you have {clinic_count}. "
                    "Upgrade to Growth for unlimited branches."
                ),
            )

        # A new branch runs on whatever the owner is paying for.
        branch_plan = current_plan or plans.DEFAULT_PLAN

        # Determine branch label and parent based on existing clinics
        existing_clinics = db.execute(
            select(Clinic.id, Clinic.clinic_label).join(
                user_clinics, user_clinics.c.clinic_id == Clinic.id
            ).where(
                user_clinics.c.user_id == current_user.id,
                user_clinics.c.role == 'clinic_owner',
                user_clinics.c.is_active == True,
            ).order_by(Clinic.id.asc())
        ).fetchall()

        new_label = None
        new_parent_id = None
        if existing_clinics:
            # Auto-label the first clinic as Main Branch if not already labeled
            first = existing_clinics[0]
            if not first.clinic_label:
                db.execute(
                    Clinic.__table__.update()
                    .where(Clinic.id == first.id)
                    .values(clinic_label="main_branch")
                )
            new_label = "branch"
            new_parent_id = first.id

        # Inherit locale from parent clinic (or use defaults)
        parent_clinic = db.query(Clinic).filter(Clinic.id == new_parent_id).first() if new_parent_id else None

        # Determine the branch's country: use the one chosen on the form if given,
        # otherwise fall back to the parent clinic, then to India. Currency, timezone
        # and tax label are derived from that country so they are always consistent
        # (instead of defaulting to ₹ regardless of country).
        from core.countries import get_country_config
        branch_country = getattr(clinic_data, 'country', None) or (parent_clinic.country if parent_clinic else 'IN')
        cfg = get_country_config(branch_country)

        # Create the new clinic
        new_clinic = Clinic(
            name=clinic_data.name,
            address=getattr(clinic_data, 'address', None),
            phone=getattr(clinic_data, 'phone', None),
            email=getattr(clinic_data, 'email', None),
            gst_number=getattr(clinic_data, 'gst_number', None),
            specialization=getattr(clinic_data, 'specialization', 'dental'),
            clinic_code=generate_clinic_code(),
            status='active',
            subscription_plan=branch_plan,
            clinic_label=new_label,
            parent_clinic_id=new_parent_id,
            country=branch_country,
            currency_code=cfg['currency_code'],
            currency_symbol=cfg['currency_symbol'],
            timezone=cfg['timezone'],
            tax_label=cfg['tax_label'],
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )
        db.add(new_clinic)
        db.flush()  # Get the new clinic ID without committing

        # Link this clinic to the owner via user_clinics (many-to-many)
        db.execute(
            user_clinics.insert().values(
                user_id=current_user.id,
                clinic_id=new_clinic.id,
                role='clinic_owner',
                is_active=True,
                created_at=datetime.datetime.utcnow()
            )
        )
        db.commit()
        db.refresh(new_clinic)

        # Seed defaults (wallet credit, trial sub if missing, procedures, clinical settings)
        try:
            from domains.auth.routes.auth_clean import _seed_clinic_defaults
            _seed_clinic_defaults(db, new_clinic.id)
        except Exception as seed_err:
            print(f"Non-fatal: failed to seed branch defaults: {seed_err}")

        notify(
            "branch_added", channel="email",
            to_email=current_user.email,
            to_name=getattr(current_user, 'first_name', '') or current_user.email,
            template_data={
                "owner_name": getattr(current_user, 'first_name', None) or current_user.email.split('@')[0],
                "branch_name": new_clinic.name,
            }
        )

        return ClinicResponseDTO.from_orm(new_clinic)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create clinic: {str(e)}"
        )



@router.get(
    "/",
    response_model=List[ClinicResponseDTO],
    summary="Get clinics",
    description="Retrieve paginated list of active clinics"
)
async def get_clinics(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    subscription_plan: Optional[str] = Query(None, description="Filter by subscription plan"),
    clinic_service = Depends(get_clinic_service)
):
    """
    Get clinics with optional filtering.

    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    - **subscription_plan**: Filter clinics by subscription plan
    """
    try:
        if subscription_plan:
            clinics = clinic_service.get_clinics_by_plan(subscription_plan, skip, limit)
        else:
            clinics = clinic_service.get_active_clinics(skip, limit)

        return [ClinicResponseDTO.from_orm(clinic) for clinic in clinics]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve clinics: {str(e)}"
        )


@router.post(
    "/",
    response_model=ClinicResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new clinic",
    description="Create a new clinic (admin only)"
)
async def create_clinic(
    clinic_data: ClinicCreateDTO,
    clinic_service = Depends(get_clinic_service),
    current_user = Depends(require_role("clinic_owner"))  # Only clinic owners can create clinics
):
    """
    Create a new clinic.

    Requires clinic_owner role. The clinic will be created with default settings.
    """
    try:
        clinic = clinic_service.create_clinic(clinic_data.dict())

        return ClinicResponseDTO.from_orm(clinic)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create clinic: {str(e)}"
        )


@router.get(
    "/{clinic_id}/branding",
    summary="Public clinic branding (no auth)",
    description=(
        "Read-only, narrow slice of clinic info — name, primary_color, logo_url, "
        "tagline. Used by the consent signing page (`/consent/sign/:token`) so "
        "patients see the actual clinic letterhead, not a hardcoded brand."
    ),
)
async def get_clinic_branding(
    clinic_id: int,
    db: Session = Depends(get_db),
):
    """Anonymous-readable subset. Returns only fields safe to expose."""
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    # Layer in the consent-template config so the signing page header matches
    # what the eventual signed PDF will look like.
    from models import TemplateConfiguration
    cfg = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == clinic_id,
        TemplateConfiguration.category == "consent",
    ).first()
    return {
        "clinic_id": clinic.id,
        "name": clinic.name,
        "tagline": getattr(clinic, "tagline", None),
        "primary_color": (cfg.primary_color if cfg and cfg.primary_color else None) or getattr(clinic, "primary_color", None),
        "logo_url": (cfg.logo_url if cfg and cfg.logo_url else None) or getattr(clinic, "logo_url", None),
    }


@router.get(
    "/me",
    response_model=ClinicResponseDTO,
    summary="Get current user's clinic",
    description="Retrieve the clinic associated with the current user"
)
async def get_my_clinic(
    clinic_service = Depends(get_clinic_service),
    current_user = Depends(get_current_user)
):
    """
    Get the current user's clinic information.
    """
    if not current_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not associated with any clinic"
        )

    try:
        clinic = clinic_service.get_clinic(current_user.clinic_id)
        if not clinic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )

        return ClinicResponseDTO.from_orm(clinic)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve clinic: {str(e)}"
        )


@router.get(
    "/{clinic_id}",
    response_model=ClinicResponseDTO,
    summary="Get clinic by ID",
    description="Retrieve a specific clinic by its ID"
)
async def get_clinic(
    clinic_id: int,
    clinic_service = Depends(get_clinic_service),
    current_user = Depends(get_current_user)
):
    """
    Get a specific clinic by ID.

    Returns clinic information including settings and subscription details.
    Callers must be a member of the clinic — this endpoint returns the full
    record; `/{clinic_id}/branding` is the public, safe-subset alternative.
    """
    try:
        _ensure_clinic_access(current_user, clinic_id)

        clinic = clinic_service.get_clinic(clinic_id)
        if not clinic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )

        return ClinicResponseDTO.from_orm(clinic)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve clinic: {str(e)}"
        )



def _normalise_currency(update_data: dict) -> None:
    """Keep currency_code and currency_symbol agreeing with each other.

    The client picks a code and nothing else; the symbol is resolved here from
    the same table the picker was built from. Letting a request set the two
    independently means one hand-edited call leaves the clinic rendering "$"
    against INR totals, and nothing downstream would catch it because invoices
    store bare numbers and read the symbol off the clinic at print time.
    """
    code = update_data.get("currency_code")
    if code is None:
        # Not changing the currency, so a symbol on its own has nothing to
        # agree with. Drop it rather than trust it.
        update_data.pop("currency_symbol", None)
        return

    from core.countries import get_currency_config
    cfg = get_currency_config(code)
    if not cfg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported currency: {code}",
        )
    update_data["currency_code"] = cfg["code"]
    update_data["currency_symbol"] = cfg["symbol"]

@router.put(
    "/me",
    response_model=ClinicResponseDTO,
    summary="Update current user's clinic",
    description="Update the clinic associated with the current user"
)
async def update_my_clinic(
    clinic_data: ClinicUpdateDTO,
    clinic_service = Depends(get_clinic_service),
    current_user = Depends(get_current_user)
):
    """
    Update the current user's clinic information.
    """
    if not current_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not associated with any clinic"
        )

    try:
        # Filter out None values
        update_data = {k: v for k, v in clinic_data.dict().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields provided for update"
            )

        _normalise_currency(update_data)

        clinic = clinic_service.update_clinic(current_user.clinic_id, update_data)

        if not clinic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )

        return ClinicResponseDTO.from_orm(clinic)

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
            detail=f"Failed to update clinic: {str(e)}"
        )


@router.put(
    "/{clinic_id}",
    response_model=ClinicResponseDTO,
    summary="Update clinic",
    description="Update clinic information and settings"
)
async def update_clinic(
    clinic_id: int,
    clinic_data: ClinicUpdateDTO,
    request: Request,
    clinic_service = Depends(get_clinic_service),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update clinic information.

    Only clinic owners or users belonging to the clinic can update it.
    """
    try:
        # Membership decides access, not role: any clinic_owner used to pass
        # this check for any clinic_id.
        _ensure_clinic_access(current_user, clinic_id)

        # Filter out None values
        update_data = {k: v for k, v in clinic_data.dict().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields provided for update"
            )

        _normalise_currency(update_data)

        clinic = clinic_service.update_clinic(clinic_id, update_data)

        # Name the fields, not just "settings changed": the point of the entry
        # is being able to tell later WHAT somebody altered.
        record_audit(
            db, current_user, CLINIC_UPDATED,
            "Changed clinic settings: " + ", ".join(sorted(update_data.keys()))[:400],
            request=request, entity_type='clinic', entity_id=clinic_id,
        )
        db.commit()

        if not clinic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )

        return ClinicResponseDTO.from_orm(clinic)

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
            detail=f"Failed to update clinic: {str(e)}"
        )


@router.delete(
    "/{clinic_id}",
    response_model=SuccessResponseDTO,
    summary="Deactivate clinic",
    description="Deactivate a clinic (admin only)"
)
async def deactivate_clinic(
    clinic_id: int,
    clinic_service = Depends(get_clinic_service),
    current_user = Depends(require_role("clinic_owner"))
):
    """
    Deactivate a clinic.

    This will mark the clinic as inactive. Requires clinic_owner role *and*
    membership of this clinic — the role alone used to be enough for any id.
    """
    try:
        _ensure_clinic_access(current_user, clinic_id)

        success = clinic_service.deactivate_clinic(clinic_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )

        return SuccessResponseDTO(
            message="Clinic deactivated successfully",
            data={"clinic_id": clinic_id}
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
            detail=f"Failed to deactivate clinic: {str(e)}"
        )


@router.get(
    "/{clinic_id}/stats",
    summary="Get clinic statistics",
    description="Retrieve comprehensive statistics for a clinic"
)
async def get_clinic_stats(
    clinic_id: int,
    clinic_service = Depends(get_clinic_service),
    current_user = Depends(get_current_user)
):
    """
    Get comprehensive clinic statistics.

    Includes user count, subscription info, and other metrics.
    """
    try:
        # Check permissions
        if current_user.role != "clinic_owner" and current_user.clinic_id != clinic_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to view this clinic's statistics"
            )

        stats = clinic_service.get_clinic_stats(clinic_id)

        if not stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )

        return {
            "clinic_id": clinic_id,
            "statistics": stats
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve clinic statistics: {str(e)}"
        )


@router.put(
    "/{clinic_id}/subscription",
    response_model=SuccessResponseDTO,
    summary="Update clinic subscription",
    description="Update clinic subscription plan (admin only)"
)
async def update_subscription(
    clinic_id: int,
    subscription_plan: str = Query(..., description="New subscription plan"),
    razorpay_subscription_id: Optional[str] = Query(None, description="Razorpay subscription ID"),
    clinic_service = Depends(get_clinic_service),
    current_user = Depends(require_role("clinic_owner"))
):
    """
    Update clinic subscription plan.

    Requires admin privileges. Used for subscription management.
    """
    try:
        # Both the current names and every legacy one, because this is an admin
        # endpoint that support tooling calls with whatever a row already holds.
        valid_plans = sorted(
            {plans.stored_name(k, c) for k in plans.PLANS for c in plans.CYCLES}
            | set(plans.LEGACY_ALIASES)
        )
        if subscription_plan not in valid_plans:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid subscription plan. Must be one of: {', '.join(valid_plans)}"
            )

        success = clinic_service.update_subscription(
            clinic_id,
            subscription_plan,
            razorpay_subscription_id
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )

        return SuccessResponseDTO(
            message="Subscription updated successfully",
            data={
                "clinic_id": clinic_id,
                "subscription_plan": subscription_plan
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update subscription: {str(e)}"
        )


@router.get(
    "/search/",
    response_model=List[ClinicResponseDTO],
    summary="Search clinics",
    description="Search clinics by name or email"
)
async def search_clinics(
    q: str = Query(..., min_length=2, description="Search query"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    clinic_service = Depends(get_clinic_service)
):
    """
    Search clinics by name or email.

    Returns clinics matching the search query.
    """
    try:
        clinics = clinic_service.search_clinics(q, skip, limit)

        return [ClinicResponseDTO.from_orm(clinic) for clinic in clinics]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search clinics: {str(e)}"
        )

@router.get(
    "/me/setup-status",
    summary="Clinic setup checklist",
    description="What's configured and what still isn't, for the Control Center progress ring.",
)
async def get_setup_status(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """One call, one round trip.

    The alternative was the sidebar fanning out to /clinics/me, /clinic-users,
    /treatment-types, /security and /template-configs on every render of every
    Control Center page. Each check below is a cheap existence test, and each
    one points at the screen that resolves it — a checklist that tells you
    something is missing without saying where to go is just nagging.
    """
    from models import Clinic, User, TreatmentType, TemplateConfiguration

    clinic_id = current_user.clinic_id
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    def _filled(*values):
        return all(str(v or '').strip() for v in values)

    has_treatments = db.query(TreatmentType.id).filter(
        TreatmentType.clinic_id == clinic_id,
        TreatmentType.is_active == True,  # noqa: E712 — SQL boolean, not Python
    ).first() is not None

    # More than one, because the owner's own account doesn't count as a team.
    team_size = db.query(User.id).filter(User.clinic_id == clinic_id).count()

    has_branding = db.query(TemplateConfiguration.id).filter(
        TemplateConfiguration.clinic_id == clinic_id
    ).first() is not None

    items = [
        {
            "key": "contact", "label": "Clinic name, phone and address",
            "hint": "Printed at the top of every invoice and prescription.",
            "path": "/admin/clinic",
            "done": _filled(clinic.name, clinic.phone, clinic.address),
        },
        {
            "key": "logo", "label": "Clinic logo",
            "hint": "Without one, documents fall back to your initials.",
            "path": "/admin/clinic",
            "done": _filled(clinic.logo_url),
        },
        {
            "key": "hours", "label": "Opening hours",
            "hint": "Drives the booking page and appointment slots.",
            "path": "/admin/clinic",
            "done": bool(clinic.timings),
        },
        {
            "key": "licence", "label": "Registration number",
            "hint": "Appears on documents when you choose to show it.",
            "path": "/admin/clinic",
            "done": _filled(clinic.license_number),
        },
        {
            "key": "treatments", "label": "Treatments and prices",
            "hint": "Until these exist there is nothing to pick when billing.",
            "path": "/admin/treatments",
            "done": has_treatments,
        },
        {
            "key": "team", "label": "Invite your team",
            "hint": "Give reception and other doctors their own sign-in.",
            "path": "/admin/staff",
            "done": team_size > 1,
        },
        {
            "key": "recovery", "label": "Verify a recovery contact",
            "hint": "How you get back in if you're locked out.",
            "path": "/admin/security/verification",
            "done": bool(clinic.security_phone_verified or clinic.security_email_verified),
        },
        {
            # A NULL hash means the clinic is still on the factory default, which
            # is public knowledge. Until it is changed, the six digits guarding
            # every irreversible delete are the same six digits every other
            # clinic has.
            "key": "master_password", "label": "Set your master password",
            "hint": "The six digits asked for before a delete nothing can undo.",
            "path": "/admin/security/verification",
            "done": bool(clinic.master_password_hash),
        },
        {
            "key": "branding", "label": "Document appearance",
            "hint": "Pick a layout and choose what prints on it.",
            "path": "/admin/templates-editor",
            "done": has_branding,
        },
    ]

    completed = sum(1 for i in items if i["done"])
    total = len(items)
    return {
        "completed": completed,
        "total": total,
        "percent": round(completed * 100 / total) if total else 0,
        "items": items,
    }
