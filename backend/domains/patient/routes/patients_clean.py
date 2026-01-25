"""
Patient routes using clean architecture
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from core.dtos import (
    PatientCreateDTO,
    PatientUpdateDTO,
    PatientResponseDTO,
    PatientSummaryDTO,
    PaginatedResponseDTO,
    SuccessResponseDTO,
    ErrorResponseDTO
)
from core.dependencies import get_patient_service
from core.auth_utils import get_current_user, require_patients_view, require_patients_edit, require_patients_delete

router = APIRouter()


@router.get(
    "/",
    response_model=List[PatientResponseDTO],
    summary="Get patients for current clinic",
    description="Retrieve paginated list of patients for the authenticated user's clinic"
)
async def get_patients(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    search: Optional[str] = Query(None, min_length=2, description="Search query for patient name or phone"),
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service)
):
    """
    Get patients for the current clinic with optional search.

    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    - **search**: Optional search query for patient name or phone (minimum 2 characters)
    """
    try:
        if search:
            patients = patient_service.search_patients(current_user.clinic_id, search, skip, limit)
        else:
            patients = patient_service.get_patients(current_user.clinic_id, skip, limit)

        return [PatientResponseDTO.from_orm(patient) for patient in patients]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve patients: {str(e)}"
        )


@router.post(
    "/",
    response_model=PatientResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new patient",
    description="Create a new patient record for the current clinic"
)
async def create_patient(
    patient_data: PatientCreateDTO,
    current_user = Depends(require_patients_edit),
    patient_service = Depends(get_patient_service)
):
    """
    Create a new patient.

    The patient will be automatically associated with the current user's clinic.
    A draft invoice will be created automatically.
    """
    try:
        patient = patient_service.create_patient(
            patient_data.dict(),
            current_user.clinic_id
        )
        return PatientResponseDTO.from_orm(patient)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create patient: {str(e)}"
        )


@router.get(
    "/{patient_id}",
    response_model=PatientResponseDTO,
    summary="Get patient by ID",
    description="Retrieve a specific patient by their ID"
)
async def get_patient(
    patient_id: int,
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service)
):
    """
    Get a specific patient by ID.

    The patient must belong to the current user's clinic.
    """
    try:
        patient = patient_service.get_patient(patient_id, current_user.clinic_id)
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )

        return PatientResponseDTO.from_orm(patient)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve patient: {str(e)}"
        )


@router.put(
    "/{patient_id}",
    response_model=PatientResponseDTO,
    summary="Update patient",
    description="Update an existing patient's information"
)
async def update_patient(
    patient_id: int,
    patient_data: PatientUpdateDTO,
    current_user = Depends(require_patients_edit),
    patient_service = Depends(get_patient_service)
):
    """
    Update a patient's information.

    Only non-null fields in the request will be updated.
    The patient must belong to the current user's clinic.
    """
    try:
        # Filter out None values
        update_data = {k: v for k, v in patient_data.dict().items() if v is not None}

        print(f"📝 [UPDATE PATIENT] Patient ID: {patient_id}")
        print(f"📝 [UPDATE PATIENT] Update data keys: {list(update_data.keys())}")
        print(f"📝 [UPDATE PATIENT] Has dental_chart: {'dental_chart' in update_data}")
        print(f"📝 [UPDATE PATIENT] Has tooth_notes: {'tooth_notes' in update_data}")
        print(f"📝 [UPDATE PATIENT] Has treatment_plan: {'treatment_plan' in update_data}")
        print(f"📝 [UPDATE PATIENT] Has prescriptions: {'prescriptions' in update_data}")

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields provided for update"
            )

        patient = patient_service.update_patient(
            patient_id,
            update_data,
            current_user.clinic_id
        )
        print(f"✅ [UPDATE PATIENT] Patient updated successfully")

        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )

        return PatientResponseDTO.from_orm(patient)

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
            detail=f"Failed to update patient: {str(e)}"
        )


@router.delete(
    "/{patient_id}",
    response_model=SuccessResponseDTO,
    summary="Delete patient",
    description="Delete a patient record (only if no payments or reports exist)"
)
async def delete_patient(
    patient_id: int,
    current_user = Depends(require_patients_delete),
    patient_service = Depends(get_patient_service)
):
    """
    Delete a patient.

    This operation will fail if the patient has existing payments or reports.
    The patient must belong to the current user's clinic.
    """
    try:
        success = patient_service.delete_patient(patient_id, current_user.clinic_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )

        return SuccessResponseDTO(
            message="Patient deleted successfully",
            data={"patient_id": patient_id}
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
            detail=f"Failed to delete patient: {str(e)}"
        )


@router.get(
    "/{patient_id}/summary",
    summary="Get patient with payment summary",
    description="Retrieve a patient with their payment summary and outstanding balance"
)
async def get_patient_summary(
    patient_id: int,
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service)
):
    """
    Get a patient with payment summary.

    Includes total paid amount and outstanding balance calculation.
    """
    try:
        summary = patient_service.get_patient_with_payment_summary(
            patient_id,
            current_user.clinic_id
        )

        if not summary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )

        return {
            "patient": PatientResponseDTO.from_orm(summary["patient"]),
            "total_paid": summary["total_paid"],
            "outstanding_balance": summary["outstanding_balance"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve patient summary: {str(e)}"
        )


@router.get(
    "/summaries/list",
    summary="Get patients with payment summaries",
    description="Retrieve paginated list of patients with their payment information"
)
async def get_patients_with_summaries(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service)
):
    """
    Get patients with payment summaries.

    Returns patients with their total paid amounts and other financial information.
    """
    try:
        summaries = patient_service.get_patients_with_summaries(
            current_user.clinic_id,
            skip,
            limit
        )

        return PaginatedResponseDTO(
            items=summaries,
            total=len(summaries),
            page=(skip // limit) + 1,
            page_size=limit,
            total_pages=1  # Simplified pagination
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve patient summaries: {str(e)}"
        )


@router.get(
    "/recent/list",
    response_model=List[PatientSummaryDTO],
    summary="Get recently added patients",
    description="Retrieve patients added within the last 30 days"
)
async def get_recent_patients(
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service)
):
    """
    Get recently added patients.

    Useful for tracking new patient registrations.
    """
    try:
        patients = patient_service.get_recent_patients(current_user.clinic_id, days)

        return [PatientSummaryDTO.from_orm(patient) for patient in patients]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve recent patients: {str(e)}"
        )


@router.get(
    "/stats/overview",
    summary="Get patient statistics",
    description="Retrieve comprehensive statistics about patients in the clinic"
)
async def get_patient_stats(
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service)
):
    """
    Get patient statistics for the clinic.

    Includes total counts, gender distribution, and age statistics.
    """
    try:
        stats = patient_service.get_patient_stats(current_user.clinic_id)

        return {
            "clinic_id": current_user.clinic_id,
            "statistics": stats
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve patient statistics: {str(e)}"
        )