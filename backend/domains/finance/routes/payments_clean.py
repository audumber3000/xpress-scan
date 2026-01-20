"""
Payment routes using clean architecture
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from core.dtos import (
    PaymentCreateDTO,
    PaymentResponseDTO,
    PaginatedResponseDTO,
    SuccessResponseDTO
)
from core.dependencies import get_payment_service
from core.auth_utils import get_current_user, require_patients_view, require_patients_edit

router = APIRouter()


@router.post(
    "/",
    response_model=PaymentResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Process a payment",
    description="Process a new payment for a patient"
)
async def process_payment(
    payment_data: PaymentCreateDTO,
    payment_service = Depends(get_payment_service),
    current_user = Depends(require_patients_edit)
):
    """
    Process a new payment.

    Creates a payment record and updates patient payment status.
    """
    try:
        payment = payment_service.process_payment(
            payment_data.dict(),
            current_user.clinic_id
        )

        return PaymentResponseDTO.from_orm(payment)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process payment: {str(e)}"
        )


@router.get(
    "/patient/{patient_id}",
    response_model=List[PaymentResponseDTO],
    summary="Get patient payments",
    description="Retrieve all payments for a specific patient"
)
async def get_patient_payments(
    patient_id: int,
    payment_service = Depends(get_payment_service),
    current_user = Depends(require_patients_view)
):
    """
    Get all payments for a specific patient.

    Returns payment history in chronological order.
    """
    try:
        payments = payment_service.get_patient_payments(
            patient_id,
            current_user.clinic_id
        )

        return [PaymentResponseDTO.from_orm(payment) for payment in payments]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve patient payments: {str(e)}"
        )


@router.get(
    "/",
    response_model=List[PaymentResponseDTO],
    summary="Get clinic payments",
    description="Retrieve payments for the current clinic with optional filters"
)
async def get_payments(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    status_filter: Optional[str] = Query(None, description="Filter by payment status"),
    start_date: Optional[datetime] = Query(None, description="Filter payments from this date"),
    end_date: Optional[datetime] = Query(None, description="Filter payments until this date"),
    payment_service = Depends(get_payment_service),
    current_user = Depends(require_patients_view)
):
    """
    Get payments for the current clinic with optional filtering.

    - **payment_method**: Filter by payment method (Cash, Card, UPI, etc.)
    - **status_filter**: Filter by payment status (success, pending, failed)
    - **start_date**: Filter payments from this date onwards
    - **end_date**: Filter payments until this date
    """
    try:
        if start_date and end_date:
            payments = payment_service.get_payments_by_date_range(
                current_user.clinic_id,
                start_date,
                end_date
            )
        elif payment_method:
            payments = payment_service.get_payments_by_method(
                current_user.clinic_id,
                payment_method
            )
        else:
            # Get recent payments (simplified - would need pagination)
            payments = payment_service.get_pending_payments(current_user.clinic_id)

        # Apply status filter if provided
        if status_filter:
            payments = [p for p in payments if p.status == status_filter]

        # Apply pagination
        payments = payments[skip:skip + limit]

        return [PaymentResponseDTO.from_orm(payment) for payment in payments]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve payments: {str(e)}"
        )


@router.put(
    "/{payment_id}/status",
    response_model=SuccessResponseDTO,
    summary="Update payment status",
    description="Update the status of a payment"
)
async def update_payment_status(
    payment_id: int,
    status: str = Query(..., description="New payment status", pattern="^(success|pending|failed|refunded)$"),
    payment_service = Depends(get_payment_service),
    current_user = Depends(require_patients_edit)
):
    """
    Update payment status.

    Used for processing refunds, marking payments as failed, etc.
    """
    try:
        success = payment_service.update_payment_status(
            payment_id,
            status,
            current_user.clinic_id
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )

        return SuccessResponseDTO(
            message="Payment status updated successfully",
            data={"payment_id": payment_id, "status": status}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update payment status: {str(e)}"
        )


@router.get(
    "/stats/summary",
    summary="Get payment summary",
    description="Retrieve payment statistics for the clinic"
)
async def get_payment_summary(
    payment_service = Depends(get_payment_service),
    current_user = Depends(require_patients_view)
):
    """
    Get comprehensive payment summary for the clinic.

    Includes total amounts, method breakdown, and trends.
    """
    try:
        summary = payment_service.get_payment_summary(current_user.clinic_id)

        return {
            "clinic_id": current_user.clinic_id,
            "summary": summary
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve payment summary: {str(e)}"
        )


@router.get(
    "/patient/{patient_id}/balance",
    summary="Get patient balance",
    description="Calculate outstanding balance for a patient"
)
async def get_patient_balance(
    patient_id: int,
    payment_service = Depends(get_payment_service),
    current_user = Depends(require_patients_view)
):
    """
    Calculate outstanding balance for a patient.

    Returns total amount owed and payment history summary.
    """
    try:
        balance = payment_service.calculate_outstanding_balance(
            patient_id,
            current_user.clinic_id
        )

        return {
            "patient_id": patient_id,
            "outstanding_balance": balance
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate patient balance: {str(e)}"
        )


@router.get(
    "/details/",
    summary="Get payments with details",
    description="Retrieve payments with patient and user details"
)
async def get_payments_with_details(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    payment_service = Depends(get_payment_service),
    current_user = Depends(require_patients_view)
):
    """
    Get payments with full details including patient and staff information.

    Useful for detailed reporting and payment reconciliation.
    """
    try:
        payments = payment_service.get_payments_with_details(
            current_user.clinic_id,
            skip,
            limit
        )

        return PaginatedResponseDTO(
            items=payments,
            total=len(payments),
            page=(skip // limit) + 1,
            page_size=limit,
            total_pages=1  # Simplified pagination
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve payment details: {str(e)}"
        )


@router.get(
    "/pending/",
    response_model=List[PaymentResponseDTO],
    summary="Get pending payments",
    description="Retrieve all pending payments for the clinic"
)
async def get_pending_payments(
    payment_service = Depends(get_payment_service),
    current_user = Depends(require_patients_view)
):
    """
    Get all pending payments for the clinic.

    Useful for payment reconciliation and follow-up.
    """
    try:
        payments = payment_service.get_pending_payments(current_user.clinic_id)

        return [PaymentResponseDTO.from_orm(payment) for payment in payments]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve pending payments: {str(e)}"
        )