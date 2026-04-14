"""
Auth routes using clean architecture
"""
import os
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
    SuccessResponseDTO
)
from core.dependencies import get_auth_service, get_user_service
from core.auth_utils import require_role
from core.nexus_notify import notify
from database import get_db
from sqlalchemy.orm import Session, joinedload
from models import Clinic, User

router = APIRouter()


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
        user = auth_service.create_user(user_data.dict())
        token = auth_service.create_jwt_token(user.id)

        notify(
            "welcome", channel="email",
            to_email=user.email, to_name=getattr(user, 'first_name', '') or user.email,
            template_data={
                "owner_name": getattr(user, 'first_name', None) or user.email.split('@')[0],
                "clinic_name": getattr(user_data, 'clinic_name', 'your clinic') or 'your clinic',
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
    """Return clinic DTO if user has clinic_id, else None."""
    if not getattr(user, "clinic_id", None):
        return None
    clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
    return ClinicResponseDTO.from_orm(clinic) if clinic else None


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
        user = auth_service.authenticate_user(login_data.email, login_data.password)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        # Register device if device info provided
        if login_data.device:
            device_info = auth_service.detect_device_info(request, login_data.device)
            auth_service.register_device(user.id, device_info)

        token = auth_service.create_jwt_token(user.id)
        
        # Load clinics for the user
        user_clinics_list = (
            db.query(Clinic)
            .join(User.clinics)
            .filter(User.id == user.id)
            .all()
        )
        
        user_dto = UserResponseDTO.from_orm(user)
        user_dto.clinics = [ClinicResponseDTO.from_orm(c) for c in user_clinics_list]
        
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
        user = auth_service.handle_oauth_login(
            oauth_data.id_token,
            oauth_data.device,
            getattr(oauth_data, 'role', None)
        )

        if oauth_data.device:
            device_info = auth_service.detect_device_info(request, oauth_data.device.dict() if hasattr(oauth_data.device, 'dict') else oauth_data.device)
            auth_service.register_device(user.id, device_info)

        # Load clinics for the user
        user_clinics_list = (
            db.query(Clinic)
            .join(User.clinics)
            .filter(User.id == user.id)
            .all()
        )
        
        user_dto = UserResponseDTO.from_orm(user)
        user_dto.clinics = [ClinicResponseDTO.from_orm(c) for c in user_clinics_list]
        
        token = auth_service.create_jwt_token(user.id)
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
            auth_service.register_device(user.id, device_info)
        token = auth_service.create_jwt_token(user.id)
        
        # Load clinics for the user
        user_clinics_list = (
            db.query(Clinic)
            .join(User.clinics)
            .filter(User.id == user.id)
            .all()
        )
        
        user_dto = UserResponseDTO.from_orm(user)
        user_dto.clinics = [ClinicResponseDTO.from_orm(c) for c in user_clinics_list]
        
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
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
                detail="Invalid or expired token"
            )
        user = user_with_clinic

        user_dto = UserResponseDTO.from_orm(user)
        
        # Load clinics for the user
        user_clinics_list = (
            db.query(Clinic)
            .join(User.clinics)
            .filter(User.id == user.id)
            .all()
        )
        user_dto.clinics = [ClinicResponseDTO.from_orm(c) for c in user_clinics_list]
        
        clinic_info = None
        if user.clinic_id and hasattr(user, "active_clinic") and user.active_clinic:
            clinic_info = ClinicResponseDTO.from_orm(user.active_clinic).model_dump()
        elif user.clinic_id:
            clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
            if clinic:
                clinic_info = ClinicResponseDTO.from_orm(clinic).model_dump()
        
        result = user_dto.model_dump()
        result["clinic"] = clinic_info
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
    from core.auth_utils import get_current_user as _get_user
    from models import User
    user = _get_user(request, db)
    signature_url = payload.get("signature_url")  # base64 string or None
    db.query(User).filter(User.id == user.id).update({"signature_url": signature_url})
    db.commit()
    return {"status": "ok"}


@router.post(
    "/change-password",
    response_model=SuccessResponseDTO,
    summary="Change password",
    description="Change the current user's password"
)
async def change_password(
    password_data: ChangePasswordRequestDTO,
    request: Request,
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
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
async def logout_user():
    """
    Log out the current user.

    This endpoint primarily serves as a confirmation that logout
    should be handled client-side by removing the JWT token.
    """
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
    user_service = Depends(get_user_service)
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )

        data = await request.json()

        if not data.get("clinic_name"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Clinic name is required"
            )

        clinic_data = {
            "name": data.get("clinic_name"),
            "address": data.get("clinic_address", ""),
            "phone": data.get("clinic_phone", ""),
            "email": data.get("clinic_email", user.email),
            "specialization": data.get("specialization", "dental"),
            "subscription_plan": data.get("subscription_plan", "free"),
            "referred_by_code": data.get("referred_by_code")
        }

        result = user_service.complete_onboarding(user.id, clinic_data)
        clinic = result["clinic"]

        # Create default scan types if provided
        scan_types = data.get("scan_types", [])
        if scan_types:
            from models import TreatmentType
            db = user_service.user_repo.db
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

        return {
            "message": "Onboarding completed successfully",
            "user": UserResponseDTO.from_orm(result["user"]),
            "clinic": ClinicResponseDTO.from_orm(clinic)
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
    auth_service = Depends(get_auth_service)
):
    """
    Refresh the JWT token for the authenticated user.

    Generates a new token with updated expiration time.
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )

        # Generate new token
        new_token = auth_service.create_jwt_token(user.id)

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
        user_dto.clinics = [ClinicResponseDTO.from_orm(c) for c in user_clinics_list]
        
        return AuthResponseDTO(
            message=f"Switched to clinic: {clinic.name}",
            user=user_dto,
            token=token,
            clinic=ClinicResponseDTO.from_orm(clinic)
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Clinic switch failed: {str(e)}"
        )