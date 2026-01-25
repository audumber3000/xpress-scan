"""
Treatment Plan routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel, Field
from database import get_db
from core.auth_utils import get_current_user, require_patients_edit
from domains.patient.services.treatment_plan_service import TreatmentPlanService
from models import User

router = APIRouter()


class TreatmentPlanCreate(BaseModel):
    procedure: str = Field(..., min_length=1, max_length=200)
    tooth: int = Field(None, ge=1, le=32)
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    time: str = Field(None, description="Time in HH:MM format (24-hour)")
    status: str = Field(default="planned", pattern="^(planned|in_progress|completed|cancelled)$")
    cost: float = Field(default=0, ge=0)
    notes: str = Field(default="")
    doctor_id: int = Field(None, description="Assigned doctor ID")
    duration: int = Field(default=60, ge=15, le=480, description="Duration in minutes")
    create_appointment: bool = Field(default=True, description="Create appointment for this plan")


class TreatmentPlanUpdate(BaseModel):
    procedure: str = Field(None, min_length=1, max_length=200)
    tooth: int = Field(None, ge=1, le=32)
    date: str = Field(None, description="Date in YYYY-MM-DD format")
    time: str = Field(None, description="Time in HH:MM format (24-hour)")
    status: str = Field(None, pattern="^(planned|in_progress|completed|cancelled)$")
    cost: float = Field(None, ge=0)
    notes: str = None
    doctor_id: int = None
    duration: int = Field(None, ge=15, le=480, description="Duration in minutes")


class TreatmentPlanResponse(BaseModel):
    id: Any
    procedure: str
    tooth: int = None
    date: str
    time: str = None
    status: str
    cost: float
    notes: str
    doctor_id: int = None
    duration: int = None
    appointment_id: int = None
    created_at: str = None
    updated_at: str = None


@router.get("/{patient_id}/treatment-plans", response_model=List[TreatmentPlanResponse])
async def get_treatment_plans(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all treatment plans for a patient"""
    try:
        service = TreatmentPlanService(db)
        plans = service.get_treatment_plans(patient_id, current_user.clinic_id)
        return plans
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve treatment plans: {str(e)}"
        )


@router.post("/{patient_id}/treatment-plans", response_model=TreatmentPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_treatment_plan(
    patient_id: int,
    plan_data: TreatmentPlanCreate,
    current_user: User = Depends(require_patients_edit),
    db: Session = Depends(get_db)
):
    """Create a new treatment plan and optionally create an appointment"""
    try:
        service = TreatmentPlanService(db)
        new_plan = service.create_treatment_plan(
            patient_id=patient_id,
            clinic_id=current_user.clinic_id,
            plan_data=plan_data.dict(),
            create_appointment=plan_data.create_appointment
        )
        return new_plan
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create treatment plan: {str(e)}"
        )


@router.put("/{patient_id}/treatment-plans/{plan_id}", response_model=TreatmentPlanResponse)
async def update_treatment_plan(
    patient_id: int,
    plan_id: str,
    updates: TreatmentPlanUpdate,
    current_user: User = Depends(require_patients_edit),
    db: Session = Depends(get_db)
):
    """Update a treatment plan"""
    try:
        service = TreatmentPlanService(db)
        
        # Filter out None values
        update_data = {k: v for k, v in updates.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields provided for update"
            )
        
        updated_plan = service.update_treatment_plan(
            patient_id=patient_id,
            clinic_id=current_user.clinic_id,
            plan_id=plan_id,
            updates=update_data
        )
        
        if not updated_plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Treatment plan not found"
            )
        
        return updated_plan
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update treatment plan: {str(e)}"
        )


@router.delete("/{patient_id}/treatment-plans/{plan_id}")
async def delete_treatment_plan(
    patient_id: int,
    plan_id: str,
    delete_appointment: bool = True,
    current_user: User = Depends(require_patients_edit),
    db: Session = Depends(get_db)
):
    """Delete a treatment plan and optionally its associated appointment"""
    try:
        service = TreatmentPlanService(db)
        success = service.delete_treatment_plan(
            patient_id=patient_id,
            clinic_id=current_user.clinic_id,
            plan_id=plan_id,
            delete_appointment=delete_appointment
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Treatment plan not found"
            )
        
        return {"message": "Treatment plan deleted successfully"}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete treatment plan: {str(e)}"
        )
