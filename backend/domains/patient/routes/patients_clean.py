"""
Patient routes using clean architecture
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from typing import List, Optional, Any
import re
from sqlalchemy.orm import Session
from database import get_db
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
from domains.activity.routes.activity_log import push_activity

router = APIRouter()


@router.get(
    "/check-duplicates",
    summary="Check for duplicate patients",
    description="Search for potential duplicate patients by name, phone, or email within the current clinic"
)
async def check_duplicates(
    name: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service)
):
    """
    Check for potential duplicate patients.
    Returns a list of patients that match any of the provided criteria.
    """
    try:
        patients = patient_service.check_duplicates(
            current_user.clinic_id,
            name=name,
            phone=phone,
            email=email
        )
        # Use jsonable_encoder to bypass strict Pydantic validation for the response
        # This handles cases where SQLAlchemy objects might have slightly different data than DTO expects
        from fastapi.encoders import jsonable_encoder
        return jsonable_encoder(patients)
    except Exception as e:
        print(f"ERROR in check_duplicates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check for duplicates: {str(e)}"
        )




@router.get(
    "",
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
    "",
    response_model=PatientResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new patient",
    description="Create a new patient record for the current clinic"
)
async def create_patient(
    patient_data: PatientCreateDTO,
    current_user = Depends(require_patients_edit),
    patient_service = Depends(get_patient_service),
    db: Session = Depends(get_db)
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
        try:
            actor = getattr(current_user, 'name', None) or getattr(current_user, 'email', 'Staff')
            push_activity(db, current_user.clinic_id, 'patient_added',
                f"New patient added: {patient.name}",
                link=f"/patients/{patient.id}",
                actor_name=actor)
            db.commit()
        except Exception:
            pass
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


def _rollback_import_session(patient_service) -> None:
    """Roll back the shared DB session after a failed import row.

    create_patient commits per row; a failed commit (e.g. a NOT NULL violation)
    leaves the session needing a rollback, otherwise every subsequent row in the
    batch fails too. Best-effort — never raise from here.
    """
    try:
        patient_service.patient_repo.db.rollback()
    except Exception:
        pass


class BulkImportRequest(BaseModel):
    patients: List[dict]


@router.post(
    "/import",
    summary="Bulk import patients from CSV",
    description="Create multiple patients from rows already parsed and validated on the client."
)
async def import_patients(
    payload: BulkImportRequest,
    current_user = Depends(require_patients_edit),
    patient_service = Depends(get_patient_service),
):
    """Bulk-create patients. Each row reuses the normal create path (display_id,
    treatment-type auto-create, etc.). Name + phone are re-validated server-side;
    invalid or failing rows are skipped and reported rather than failing the batch."""
    imported_count = 0
    errors = []

    for idx, row in enumerate(payload.patients):
        row_num = idx + 1
        try:
            name = (row.get("name") or "").strip()
            phone = (row.get("phone") or "").strip()
            if not name:
                errors.append(f"Row {row_num}: Name is required")
                continue
            if len(re.sub(r"\D", "", phone)) < 7:
                errors.append(f"Row {row_num}: A valid phone number is required")
                continue

            age_raw = row.get("age")
            age = int(age_raw) if age_raw not in (None, "") and str(age_raw).strip().isdigit() else None

            # Parse an optional date of birth and registration date.
            # (accepts YYYY-MM-DD / DD-MM-YYYY / DD/MM/YYYY / MM/DD/YYYY)
            from datetime import datetime as _dt

            def _parse_date(raw):
                raw = (raw or "").strip()
                if not raw:
                    return None
                for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"):
                    try:
                        return _dt.strptime(raw, fmt)
                    except ValueError:
                        continue
                return None

            dob_dt = _parse_date(row.get("date_of_birth"))
            dob = dob_dt.date() if dob_dt else None
            registered_at = _parse_date(row.get("registered_at"))

            clean = {
                "name": name,
                "age": age,
                "date_of_birth": dob,
                "registered_at": registered_at,
                "gender": (row.get("gender") or "").strip() or None,
                "phone": phone,
                "village": (row.get("village") or "").strip() or None,
                "treatment_type": (row.get("treatment_type") or "").strip() or None,
                "referred_by": (row.get("referred_by") or "").strip() or None,
                "blood_group": (row.get("blood_group") or "").strip() or None,
                "patient_history": (row.get("patient_history") or "").strip() or None,
                "notes": (row.get("notes") or "").strip() or None,
            }
            # Drop empties so model/service defaults apply.
            clean = {k: v for k, v in clean.items() if v is not None}
            # treatment_type is NOT NULL on the model and has no default — mirror the
            # single-add behaviour and fall back to a sensible default when omitted.
            if not clean.get("treatment_type"):
                clean["treatment_type"] = "General Consultation"

            patient_service.create_patient(clean, current_user.clinic_id)
            imported_count += 1
        except ValueError as e:
            _rollback_import_session(patient_service)
            errors.append(f"Row {row_num}: {str(e)}")
        except Exception as e:
            _rollback_import_session(patient_service)
            errors.append(f"Row {row_num}: {str(e)}")

    return {
        "status": "success",
        "message": f"Successfully imported {imported_count} patient{'s' if imported_count != 1 else ''}",
        "imported_count": imported_count,
        "errors": errors,
    }


@router.get(
    "/birthdays/upcoming",
    summary="Upcoming patient birthdays",
    description="List patients whose birthday falls within the next N days (requires date_of_birth)."
)
async def get_upcoming_birthdays(
    days: int = Query(30, ge=1, le=366, description="How many days ahead to look"),
    current_user = Depends(require_patients_view),
    db: Session = Depends(get_db)
):
    """Return patients with a birthday in the next `days` days, soonest first.

    Computed in Python so it works the same on SQLite (local) and Postgres (prod).
    Each entry includes `days_until` and `turning_age` for convenient display.
    """
    from datetime import date as _date
    from models import Patient as _Patient

    try:
        patients = db.query(_Patient).filter(
            _Patient.clinic_id == current_user.clinic_id,
            _Patient.date_of_birth.isnot(None),
        ).all()

        today = _date.today()
        results = []
        for p in patients:
            dob = p.date_of_birth
            if not dob:
                continue
            # Next occurrence of this month/day (handle Feb 29 -> Feb 28 fallback).
            try:
                next_bday = dob.replace(year=today.year)
            except ValueError:
                next_bday = dob.replace(year=today.year, day=28)
            if next_bday < today:
                try:
                    next_bday = dob.replace(year=today.year + 1)
                except ValueError:
                    next_bday = dob.replace(year=today.year + 1, day=28)

            days_until = (next_bday - today).days
            if days_until <= days:
                results.append({
                    "id": p.id,
                    "display_id": p.display_id,
                    "name": p.name,
                    "phone": p.phone,
                    "gender": p.gender,
                    "village": p.village,
                    "date_of_birth": dob.isoformat(),
                    "next_birthday": next_bday.isoformat(),
                    "days_until": days_until,
                    "turning_age": next_bday.year - dob.year,
                })

        results.sort(key=lambda r: r["days_until"])
        return results

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve upcoming birthdays: {str(e)}"
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
