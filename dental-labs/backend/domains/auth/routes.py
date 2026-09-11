"""
Auth routes — registration, login, me, onboarding.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from core.auth import get_current_user
from core.countries import get_all_countries
from schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserResponse, LabBrief
from schemas.lab import LabOnboardingRequest, LabResponse
from domains.auth.service import AuthService
from models import LabUser

router = APIRouter()


def _user_response(user: LabUser) -> dict:
    """Build a UserResponse dict from a LabUser ORM instance."""
    data = {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "name": user.name,
        "role": user.role,
        "is_active": user.is_active,
        "lab_id": user.lab_id,
        "lab": None,
    }
    if user.lab:
        data["lab"] = {
            "id": user.lab.id,
            "name": user.lab.name,
            "country": user.lab.country,
            "currency_code": user.lab.currency_code,
            "currency_symbol": user.lab.currency_symbol,
            "timezone": user.lab.timezone,
            "tax_label": user.lab.tax_label,
            "case_number_prefix": user.lab.case_number_prefix,
            "logo_url": user.lab.logo_url,
            "subscription_plan": user.lab.subscription_plan,
        }
    return data


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new lab owner."""
    svc = AuthService(db)
    try:
        result = svc.register(body.email, body.password, body.first_name, body.last_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "token": result["token"],
        "user": _user_response(result["user"]),
    }


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password."""
    svc = AuthService(db)
    try:
        result = svc.login(body.email, body.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    return {
        "token": result["token"],
        "user": _user_response(result["user"]),
    }


@router.get("/me")
def get_me(user: LabUser = Depends(get_current_user)):
    """Get current user with lab info."""
    return {"user": _user_response(user)}


@router.post("/onboarding")
def onboard(
    body: LabOnboardingRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    """Complete lab onboarding — creates the lab, seeds default catalog."""
    svc = AuthService(db)
    try:
        lab = svc.onboard_lab(user, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "lab": LabResponse.model_validate(lab).model_dump(),
        "user": _user_response(user),
    }


@router.post("/logout")
def logout():
    """Client-side logout — nothing to invalidate server-side (stateless JWT)."""
    return {"message": "Logged out"}


@router.get("/countries")
def list_countries():
    """Return all countries for the onboarding dropdown."""
    return {"countries": get_all_countries()}
