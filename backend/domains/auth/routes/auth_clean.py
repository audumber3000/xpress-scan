"""
Auth routes using clean architecture
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Optional
from core.dtos import (
    LoginRequestDTO,
    RegisterRequestDTO,
    OAuthRequestDTO,
    ChangePasswordRequestDTO,
    AuthResponseDTO,
    UserResponseDTO,
    DeviceInfoDTO,
    ClinicResponseDTO,
    SuccessResponseDTO
)
from core.dependencies import get_auth_service, get_user_service
from core.auth_utils import require_role

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


@router.post(
    "/login",
    response_model=AuthResponseDTO,
    summary="User login",
    description="Authenticate user with email and password"
)
async def login_user(
    request: Request,
    login_data: LoginRequestDTO,
    auth_service = Depends(get_auth_service)
):
    """
    Authenticate user with email and password.

    Returns JWT token and user information on successful authentication.
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

        return AuthResponseDTO(
            message="Login successful",
            user=UserResponseDTO.from_orm(user),
            token=token
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
    auth_service = Depends(get_auth_service)
):
    """
    Handle OAuth authentication flow.

    Verifies the OAuth token and creates/logs in the user.
    """
    try:
        # Verify OAuth token and get/create user
        user = auth_service.handle_oauth_login(
            oauth_data.id_token, 
            oauth_data.device,
            getattr(oauth_data, 'role', None)
        )

        # Register device if device info provided
        if oauth_data.device:
            device_info = auth_service.detect_device_info(request, oauth_data.device.dict() if hasattr(oauth_data.device, 'dict') else oauth_data.device)
            auth_service.register_device(user.id, device_info)

        # Generate JWT token
        token = auth_service.create_jwt_token(user.id)

        return AuthResponseDTO(
            message="OAuth login successful",
            user=UserResponseDTO.from_orm(user),
            token=token
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


@router.get(
    "/me",
    summary="Get current user",
    description="Retrieve information about the currently authenticated user"
)
async def get_current_user(
    request: Request,
    auth_service = Depends(get_auth_service)
):
    """
    Get information about the currently authenticated user.

    Requires valid JWT token in Authorization header.
    """
    try:
        # Extract token from header
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

        user_with_clinic = auth_service.auth_repo.get_user_with_clinic(user.id)
        clinic = user_with_clinic["clinic"] if user_with_clinic else None

        clinic_info = None
        if clinic:
            clinic_info = {
                "id": clinic.id,
                "name": clinic.name,
                "address": clinic.address,
                "phone": clinic.phone,
                "email": clinic.email,
                "specialization": clinic.specialization,
                "subscription_plan": clinic.subscription_plan,
                "logo": clinic.logo_url,
                "logo_url": clinic.logo_url,
                "created_at": clinic.created_at.isoformat() if clinic.created_at else None,
                "updated_at": getattr(clinic, 'updated_at', clinic.created_at).isoformat() if getattr(clinic, 'updated_at', clinic.created_at) else None,
                "synced_at": getattr(clinic, 'synced_at', None).isoformat() if getattr(clinic, 'synced_at', None) else None,
                "sync_status": getattr(clinic, 'sync_status', 'local')
            }

        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "clinic_id": user.clinic_id,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": getattr(user, 'updated_at', user.created_at).isoformat() if getattr(user, 'updated_at', user.created_at) else None,
            "synced_at": getattr(user, 'synced_at', None).isoformat() if getattr(user, 'synced_at', None) else None,
            "sync_status": getattr(user, 'sync_status', 'local'),
            "permissions": user.permissions,
            "clinic": clinic_info
        }

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
            "subscription_plan": data.get("subscription_plan", "free")
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