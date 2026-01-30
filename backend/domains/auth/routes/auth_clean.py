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
from core.dependencies import get_auth_service
from core.auth_utils import require_role
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
        clinic = _get_clinic_for_user(db, user)

        return AuthResponseDTO(
            message="Login successful",
            user=UserResponseDTO.from_orm(user),
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

        token = auth_service.create_jwt_token(user.id)
        clinic = _get_clinic_for_user(db, user)

        return AuthResponseDTO(
            message="OAuth login successful",
            user=UserResponseDTO.from_orm(user),
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
        clinic = _get_clinic_for_user(db, user)
        return AuthResponseDTO(
            message="OAuth login successful",
            user=UserResponseDTO.from_orm(user),
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
            .options(joinedload(User.clinic))
            .filter(User.id == user.id, User.is_active == True)
            .first()
        )
        if not user_with_clinic:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        user = user_with_clinic

        user_data = UserResponseDTO.from_orm(user).model_dump()
        clinic_info = None
        if user.clinic_id and user.clinic:
            clinic_info = ClinicResponseDTO.from_orm(user.clinic).model_dump()
        elif user.clinic_id:
            clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
            if clinic:
                clinic_info = ClinicResponseDTO.from_orm(clinic).model_dump()
        user_data["clinic"] = clinic_info
        return user_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user info: {str(e)}"
        )


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