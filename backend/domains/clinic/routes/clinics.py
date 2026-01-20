"""
Clinic routes using clean architecture
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
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

router = APIRouter()


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
    clinic_service = Depends(get_clinic_service)
):
    """
    Get a specific clinic by ID.

    Returns clinic information including settings and subscription details.
    """
    try:
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
    clinic_service = Depends(get_clinic_service),
    current_user = Depends(get_current_user)
):
    """
    Update clinic information.

    Only clinic owners or users belonging to the clinic can update it.
    """
    try:
        # Check if user has permission to update this clinic
        if current_user.role != "clinic_owner" and current_user.clinic_id != clinic_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this clinic"
            )

        # Filter out None values
        update_data = {k: v for k, v in clinic_data.dict().items() if v is not None}

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields provided for update"
            )

        clinic = clinic_service.update_clinic(clinic_id, update_data)

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

    This will mark the clinic as inactive. Requires admin privileges.
    """
    try:
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
        valid_plans = ["free", "professional", "enterprise"]
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