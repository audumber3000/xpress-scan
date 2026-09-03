"""
Patient routes using clean architecture
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File, Response
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime
import csv
import io
import json
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
from core.audit import record_audit, PATIENT_DELETED, PATIENT_UPDATED
from core.master_password import require_master_token
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _parse_patient_dates(date_from: Optional[str], date_to: Optional[str]):
    """Parse optional YYYY-MM-DD registration-range strings into date objects."""
    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
        d_to = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")
    return d_from, d_to


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
    gender: Optional[str] = Query(None, description="Filter by gender"),
    treatment_type: Optional[str] = Query(None, description="Filter by treatment type"),
    date_from: Optional[str] = Query(None, description="Registered on/after (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Registered on/before (YYYY-MM-DD)"),
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service)
):
    """
    Get one page of patients for the current clinic, with optional search/filters.

    Server-side pagination: the caller pages via skip/limit, and search + filters
    run against the whole clinic (not just a preloaded page). Pair with
    `GET /patients/count` for the total to drive page numbers.
    """
    try:
        d_from, d_to = _parse_patient_dates(date_from, date_to)
        patients = patient_service.list_patients(
            current_user.clinic_id, skip, limit, search, gender, treatment_type, d_from, d_to
        )

        # Serialize per-row: a single unserializable patient must not 500 the
        # whole list (a bulk-imported age=2020 did exactly that). Skip the bad
        # row and log it rather than hiding the entire clinic's patients.
        result = []
        for patient in patients:
            try:
                result.append(PatientResponseDTO.from_orm(patient))
            except Exception as row_err:
                logger.error(
                    "Skipping unserializable patient id=%s clinic_id=%s: %s",
                    getattr(patient, "id", "?"), current_user.clinic_id, row_err,
                )
        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve patients: {str(e)}"
        )


@router.get(
    "/count",
    summary="Count patients for current clinic",
    description="Total patients matching the same search/filters — drives page numbers.",
)
async def count_patients(
    search: Optional[str] = Query(None, min_length=2),
    gender: Optional[str] = Query(None),
    treatment_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service),
):
    try:
        d_from, d_to = _parse_patient_dates(date_from, date_to)
        total = patient_service.count_patients(
            current_user.clinic_id, search, gender, treatment_type, d_from, d_to
        )
        return {"total": total}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to count patients: {str(e)}",
        )


@router.get("/export", summary="Export patients as CSV")
async def export_patients(
    search: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    treatment_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user = Depends(require_patients_view),
    patient_service = Depends(get_patient_service),
):
    """CSV of every patient matching the current search/filters (not paginated)."""
    try:
        d_from, d_to = _parse_patient_dates(date_from, date_to)
        # Search requires 2+ chars elsewhere; mirror that so a stray char is ignored.
        s = search if (search and len(search.strip()) >= 2) else None
        patients = patient_service.list_patients(
            current_user.clinic_id, 0, 100000, s, gender, treatment_type, d_from, d_to
        )

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "Patient ID", "Name", "Gender", "Age", "Date of Birth", "Phone",
            "Village/Address", "Treatment Type", "Registered On", "Created At",
        ])
        for p in patients:
            writer.writerow([
                getattr(p, "display_id", "") or "",
                p.name or "",
                p.gender or "",
                getattr(p, "age", "") if getattr(p, "age", None) is not None else "",
                p.date_of_birth.strftime("%Y-%m-%d") if getattr(p, "date_of_birth", None) else "",
                p.phone or "",
                getattr(p, "village", "") or getattr(p, "address", "") or "",
                p.treatment_type or "",
                p.registered_on.strftime("%Y-%m-%d") if getattr(p, "registered_on", None) else "",
                p.created_at.strftime("%Y-%m-%d") if getattr(p, "created_at", None) else "",
            ])

        filename = f"patients_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export patients: {str(e)}",
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
            current_user.clinic_id,
            created_by=current_user.id,
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

            from datetime import datetime as _dt

            age_raw = row.get("age")
            age = int(age_raw) if age_raw not in (None, "") and str(age_raw).strip().isdigit() else None
            # An out-of-range age must never reach the DB — a stored age=2020
            # (a birth year typed into the age column) once broke the whole
            # patient list. If it looks like a birth year, convert it to an age;
            # otherwise drop it to NULL. Either way the row still imports.
            if age is not None and not (0 <= age <= 150):
                current_year = _dt.now().year
                if 1900 <= age <= current_year:
                    age = current_year - age
                else:
                    age = None

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

            patient_service.create_patient(clean, current_user.clinic_id,
                                           created_by=current_user.id)
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


# ── Handwritten register OCR (vision LLM) ────────────────────────────────────
_REGISTER_ROW_SCHEMA = {
    "type": "object",
    "properties": {
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Patient full name as written"},
                    "age": {"type": "string", "description": "Age in years, digits only; empty if not written"},
                    "date_of_birth": {"type": "string", "description": "YYYY-MM-DD if a full DOB is written, else empty"},
                    "gender": {"type": "string", "description": "Male, Female, Other, or empty"},
                    "phone": {"type": "string", "description": "Phone digits as written; empty if none"},
                    "village": {"type": "string", "description": "Village/town/place; empty if none"},
                    "treatment_type": {"type": "string", "description": "Treatment/complaint; empty if none"},
                    "referred_by": {"type": "string", "description": "Referred by; empty if none"},
                    "registered_at": {"type": "string", "description": "YYYY-MM-DD registration date if written, else empty"},
                    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    "issues": {"type": "string", "description": "Short note on any uncertain reads; empty if confident"},
                },
                "required": [
                    "name", "age", "date_of_birth", "gender", "phone", "village",
                    "treatment_type", "referred_by", "registered_at", "confidence", "issues",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["rows"],
    "additionalProperties": False,
}

_REGISTER_SYSTEM = (
    "You are a meticulous medical-records data-entry assistant. You read photos of "
    "handwritten dental/clinic patient registers (often Indian clinics; names may be in "
    "English, Hindi, or Marathi) and transcribe each patient row into structured fields. "
    "Transcribe exactly what is written — never invent or guess data that isn't there. "
    "Leave a field empty if it is blank or unreadable. When you are unsure of a value, give "
    "your best reading but lower that row's confidence and name the uncertain field in 'issues'."
)

_REGISTER_INSTRUCTION = (
    "Extract every patient row from this register page, top to bottom. Map the columns to: "
    "name, age (digits only), date_of_birth (YYYY-MM-DD only if a full birth date is written, else empty), "
    "gender (Male/Female/Other), phone (digits only), village, treatment_type, referred_by, "
    "registered_at (YYYY-MM-DD only if a registration date is written). Normalize gender and dates. "
    "Set confidence (high/medium/low) per row and put uncertain reads in 'issues'. "
    "Return one object per patient row. If the photo contains no patient rows, return an empty list."
)


@router.post(
    "/extract-register",
    summary="Extract patient rows from photos of a handwritten register (vision LLM)",
)
async def extract_register(
    files: List[UploadFile] = File(...),
    current_user = Depends(require_patients_edit),
):
    """Read photos of a handwritten patient register and return structured rows
    for the editable import table. NOTHING is saved here; images are not persisted.
    The user reviews/edits the rows, then imports via /patients/import.
    """
    import os
    import base64
    import json
    import asyncio

    if not files:
        raise HTTPException(status_code=400, detail="No images uploaded")
    if len(files) > 12:
        raise HTTPException(status_code=400, detail="Please upload at most 12 photos at a time.")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Handwriting extraction isn't configured on the server yet (missing ANTHROPIC_API_KEY).",
        )
    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        raise HTTPException(status_code=503, detail="Handwriting extraction dependency is not installed.")

    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    client = AsyncAnthropic(api_key=api_key)

    # Claude vision only accepts these; anything else (e.g. iOS HEIC) is sent as jpeg.
    _allowed = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    images = []
    for f in files:
        raw = await f.read()
        if not raw:
            continue
        ct = (f.content_type or "").lower()
        media_type = ct if ct in _allowed else "image/jpeg"
        images.append((media_type, base64.standard_b64encode(raw).decode("ascii")))

    async def extract_page(media_type: str, b64: str):
        resp = await client.messages.create(
            model=model,
            max_tokens=16000,
            system=_REGISTER_SYSTEM,
            output_config={"format": {"type": "json_schema", "schema": _REGISTER_ROW_SCHEMA}},
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": _REGISTER_INSTRUCTION},
                ],
            }],
        )
        text = "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", None) == "text")
        return json.loads(text).get("rows", []) if text.strip() else []

    results = await asyncio.gather(
        *(extract_page(mt, b64) for mt, b64 in images),
        return_exceptions=True,
    )

    all_rows = []
    page_errors = []
    for idx, res in enumerate(results):
        if isinstance(res, Exception):
            page_errors.append(f"Page {idx + 1}: {str(res)[:200]}")
            continue
        for r in res:
            r["_page"] = idx + 1
            all_rows.append(r)

    return {"rows": all_rows, "pages": len(images), "errors": page_errors}


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
    request: Request,
    db: Session = Depends(get_db),
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

        # case_paper_type is the one field whose *absence* is the meaningful
        # value: NULL means "keep whatever the clinic keeps". Stripping None
        # along with every other unset field made "Same as clinic default"
        # impossible to choose — once a patient was pinned to dental or general
        # there was no way back. Only honoured when the client actually sent the
        # key, so an untouched form still cannot blank it by omission.
        if 'case_paper_type' in getattr(patient_data, 'model_fields_set', set()):
            update_data['case_paper_type'] = patient_data.case_paper_type

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

        # Only identity fields are logged, not every save.
        #
        # This endpoint also receives dental_chart, tooth_notes, treatment_plan
        # and prescriptions, which change on almost every visit. Recording all
        # of that would bury the deletions and money movements this log exists
        # to surface, and the clinical edits are already captured on the case
        # paper. What is worth a line here is somebody changing WHO a record is
        # about: that is what a fraudulent edit alters, and it is invisible
        # anywhere else.
        _IDENTITY = {"name", "phone", "email", "date_of_birth", "age", "gender"}
        _changed = sorted(_IDENTITY & set(update_data.keys()))
        if _changed:
            record_audit(
                db, current_user, PATIENT_UPDATED,
                f"Edited {', '.join(_changed)} for {getattr(patient, 'name', None) or f'patient #{patient_id}'}",
                request=request, entity_type='patient', entity_id=patient_id,
            )
            db.commit()

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
    description="Delete a patient record and everything attached to it. Requires the clinic's master password."
)
async def delete_patient(
    patient_id: int,
    request: Request,
    current_user = Depends(require_patients_delete),
    patient_service = Depends(get_patient_service),
    db: Session = Depends(get_db),
):
    """
    Delete a patient.

    Gated on the clinic's master password (an `X-Master-Token` from
    `/security/master-password/verify`), which is also what unlocks removing a
    patient who has paid or has reports on file — refused outright before this.
    The patient must belong to the current user's clinic.
    """
    require_master_token(request, current_user)
    try:
        # Name it before it's gone — afterwards the log could only say "patient 41".
        victim = patient_service.get_patient(patient_id, current_user.clinic_id)
        label = f"{victim.name} (#{patient_id})" if victim else f"#{patient_id}"
        # Read while the rows still exist. This is the only record that will
        # survive of what the clinic gave up, so it is worth a query.
        footprint = patient_service.financial_footprint(patient_id, current_user.clinic_id)

        success = patient_service.delete_patient(patient_id, current_user.clinic_id, force=True)

        if success:
            detail = "and all their records"
            if footprint["payments"]:
                detail = (
                    f"along with {footprint['invoices']} invoice(s) and "
                    f"{footprint['payments']} payment(s) totalling {footprint['collected']:,.2f}"
                )
            record_audit(db, current_user, PATIENT_DELETED,
                         f"Deleted patient {label} {detail}",
                         request=request, entity_type='patient', entity_id=patient_id)
            db.commit()

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


# ─── WhatsApp: ask this patient for a Google review ───────────────────────────
#
# The automatic ask fires when a payment lands. This is the deliberate one, from
# the WhatsApp menu on the patient file, for the patient who just said something
# nice at the desk. Both resolve the link and the cooldown through
# domains/notification/services/google_review_service.py so they cannot drift.


def _load_patient(db: Session, patient_id: int, clinic_id: int):
    from models import Patient
    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get(
    "/{patient_id}/google-review",
    summary="Whether this patient can be asked for a Google review",
)
async def google_review_status(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_view),
):
    """Everything the ask dialog needs to explain itself before it sends.

    It reports rather than refuses. A clinic that asked this patient six weeks
    ago is told so and can still go ahead: the cooldown exists to stop the
    automatic ask nagging people, not to overrule somebody standing in front of
    the patient.
    """
    from domains.notification.services import google_review_service as grs

    patient = _load_patient(db, patient_id, current_user.clinic_id)
    recipient = patient.phone or patient.email or ""
    link = grs.review_link(db, current_user.clinic_id)
    asked_at = grs.last_asked_at(db, current_user.clinic_id, recipient)

    return {
        "listing_connected": bool(link),
        # Two links, because they are read by two different people in two
        # different browsers. `review_link` is the Google URL, for the clinic's
        # own preview. `share_link` is what goes to the patient: it bounces
        # through /r so their phone lands in a real browser instead of the
        # signed-out window inside WhatsApp.
        "review_link": link,
        "share_link": grs.share_link(db, current_user.clinic_id),
        "recipient": recipient,
        "has_phone": bool(patient.phone),
        "last_asked_at": asked_at.isoformat() if asked_at else None,
        "within_cooldown": grs.within_cooldown(asked_at),
        "cooldown_days": grs.COOLDOWN_DAYS,
    }


@router.post(
    "/{patient_id}/google-review",
    summary="Ask this patient for a Google review on WhatsApp",
)
async def send_google_review_request(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_edit),
):
    """Send the review ask now.

    `required=True`: here the message IS the request, so an empty wallet has to
    surface as the 402 the frontend explains rather than being swallowed the way
    a side-effect send is.
    """
    from core.notification_dispatch import notify_event, InsufficientWalletBalance
    from domains.notification.services import google_review_service as grs
    from models import Clinic

    patient = _load_patient(db, patient_id, current_user.clinic_id)
    if not patient.phone:
        raise HTTPException(status_code=400, detail="This patient has no phone number on file.")

    link = grs.share_link(db, current_user.clinic_id)
    if not link:
        raise HTTPException(
            status_code=400,
            detail="No Google listing is connected yet. Connect one in Integrations → Google.",
        )

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    try:
        notify_event(
            "google_review",
            db=db,
            clinic_id=current_user.clinic_id,
            to_phone=patient.phone,
            to_name=patient.name,
            template_data={
                "patient_name": patient.name,
                "clinic_name": clinic.name if clinic else "",
                "review_link": link,
                "clinic_phone": (clinic.phone if clinic else "") or "",
            },
            required=True,
        )
    except InsufficientWalletBalance:
        # main.py turns this into the 402 carrying needed/available. Without the
        # re-raise the blanket handler below reports an empty wallet as a 500.
        raise
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not send the review request: {exc}")

    return {"sent": True, "recipient": patient.phone}


# ─── The patient's activity feed ──────────────────────────────────────────────


def _user_name(user) -> Optional[str]:
    """A staff member's name for display, or None if the row has no user."""
    if not user:
        return None
    return user.name or f"{user.first_name or ''} {user.last_name or ''}".strip() or None


@router.get(
    "/{patient_id}/activity",
    summary="Everything that has happened to this patient, newest first",
)
async def patient_activity(
    patient_id: int,
    limit: int = Query(40, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user = Depends(require_patients_view),
):
    """One chronological feed, merged from the tables that each hold a piece.

    There is no per-patient audit trail to read: AuditLog only keeps
    consequential actions (deletions, money edits) and ActivityLog is a ten-row
    FIFO for the dashboard. So this is assembled the same way the invoice
    timeline is, from the source rows themselves, each of which already records
    who did the thing. Nothing new has to be written for this to work, and
    nothing here can drift out of step with the records it describes.

    Deliberately read-only and derived. It replaces the two cards on the
    overview that showed the same visits twice, once as "latest" and once as
    "recent", and neither of which could say who anything was by.
    """
    from models import (
        Appointment, CasePaper, DailyVisit, Invoice, InvoicePayment,
        Patient, Prescription, User,
    )

    patient = _load_patient(db, patient_id, current_user.clinic_id)
    clinic_id = current_user.clinic_id
    events = []

    def stamp(day, ts):
        """The clock time, but only when it belongs to the day being described.

        Two tables here keep the same fact twice: a clinic-local calendar day
        that staff can back-date, and a row timestamp that is always the moment
        somebody typed. Normally they agree and the timestamp is the better of
        the two, because a timeline wants an hour. When they disagree the row
        was back-dated, and the timestamp is then about the typing rather than
        the event: a 2019 patient entered last Tuesday would otherwise open the
        file at the top of the feed, above their own case papers.

        So the recorded day wins the position and the timestamp only supplies
        the hour it is entitled to. A date with no time sorts before every
        timestamp on that day, which is also where an event of unknown hour
        honestly belongs.
        """
        if day and (ts is None or ts.date() != day):
            return day
        return ts

    # Same timestamp, different events: the clock cannot separate them, so the
    # order they must have happened in does. A bill is raised after the patient
    # walked in and paid after it was raised, and on a busy front desk all three
    # can land in the same second. Newest-first, so the later step sorts above.
    ORDER = {
        "registered": 0,
        "appointment": 1,
        "walk_in": 2,
        "check_in": 2,
        "case_paper": 3,
        "prescription": 4,
        "invoice": 5,
        "payment": 6,
    }

    def add(at, kind, label, **rest):
        if not at:
            return
        events.append({
            "at": at.isoformat(),
            "kind": kind,
            "label": label,
            "amount": rest.get("amount"),
            "method": rest.get("method"),
            "reference": rest.get("reference"),
            "by": rest.get("by"),
            # What to put in front of the name. "Recorded by" on a case paper
            # would be wrong in a way that matters on a clinical record: the
            # dentist who examined the patient is not the receptionist who typed
            # it up, and the row has to say which one it means.
            "by_verb": rest.get("by_verb") or "By",
            "detail": rest.get("detail"),
            "status": rest.get("status"),
        })

    # ── Where the file starts ────────────────────────────────────────────────
    #
    # created_at when it agrees with registered_on, so the row carries an hour;
    # registered_on when it does not, because a patient first seen in 2019 and
    # typed in last week belongs at the start of their own file. When the two
    # disagree, both are worth knowing, so the other is said out loud.
    reg_note = None
    if (
        patient.registered_on
        and patient.created_at
        and patient.registered_on != patient.created_at.date()
    ):
        reg_note = f"Registration date recorded as {patient.registered_on:%d %b %Y}"
    add(
        stamp(patient.registered_on, patient.created_at) or patient.created_at,
        "registered", "Patient registered",
        by=_user_name(patient.creator), by_verb="Registered by", detail=reg_note,
    )

    # ── Appointments ─────────────────────────────────────────────────────────
    appts = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient_id, Appointment.clinic_id == clinic_id)
        .all()
    )
    papers = (
        db.query(CasePaper)
        .filter(CasePaper.patient_id == patient_id, CasePaper.clinic_id == clinic_id)
        .all()
    )
    visits = (
        db.query(DailyVisit)
        .filter(DailyVisit.patient_id == patient_id, DailyVisit.clinic_id == clinic_id)
        .all()
    )

    # Every staff name this feed needs, in one query. Resolving them per row is
    # a lookup per event, and a long-standing patient has plenty of both.
    staff_ids = {a.doctor_id for a in appts if a.doctor_id}
    staff_ids |= {a.created_by for a in appts if a.created_by}
    staff_ids |= {cp.dentist_id for cp in papers if cp.dentist_id}
    staff_ids |= {v.doctor_id for v in visits if v.doctor_id}
    staff_ids |= {v.created_by for v in visits if v.created_by}
    names = {}
    if staff_ids:
        names = {
            u.id: _user_name(u)
            for u in db.query(User).filter(User.id.in_(staff_ids)).all()
        }

    for a in appts:
        # Placed at the time of the appointment, not the time it was booked:
        # this feed is read as "what happened to this patient", and the visit is
        # the thing that happened. Who booked it is the actor either way.
        with_doctor = names.get(a.doctor_id)
        add(
            a.appointment_date, "appointment", "Appointment",
            by=names.get(a.created_by), by_verb="Booked by", status=a.status,
            detail=" · ".join(x for x in (a.treatment, f"with {with_doctor}" if with_doctor else None) if x) or None,
        )

    # ── Attendance: the walk-in the user calls a direct register ─────────────
    for v in visits:
        # 'manual' is somebody typed into the day's register; 'check_in' is an
        # appointment being marked as arrived. Different events, said differently.
        walked_in = (v.source or "manual") != "check_in"
        seen_by = names.get(v.doctor_id)
        # The register stores a bare day and the row knows the hour, so stamp()
        # takes the hour when it belongs to that day. A back-dated entry keeps
        # the day it is about rather than the afternoon it was typed in.
        add(
            stamp(v.visit_date, v.created_at),
            "walk_in" if walked_in else "check_in",
            "Walked in" if walked_in else "Checked in",
            detail=" · ".join(x for x in (v.reason, f"seen by {seen_by}" if seen_by else None) if x) or None,
            by=names.get(v.created_by), by_verb="Added by",
        )

    # ── Case papers, the thing the user actually wanted attributed ───────────
    for cp in papers:
        complaint = cp.chief_complaint
        if isinstance(complaint, str) and complaint.startswith("["):
            try:
                complaint = ", ".join(x for x in json.loads(complaint) if x)
            except Exception:
                pass
        add(
            cp.date, "case_paper", "Case paper created",
            by=names.get(cp.dentist_id), by_verb="By",
            detail=complaint or cp.diagnosis,
            status=cp.status,
        )

    # ── Prescriptions ────────────────────────────────────────────────────────
    # A prescription carries no prescriber of its own. It hangs off the case
    # paper for the visit it was written during, and the dentist on that paper
    # is the person who wrote it, so that is where the name comes from. No case
    # paper, no name: an unattributed row is better than a guessed one.
    paper_dentist = {cp.id: cp.dentist_id for cp in papers}
    for rx in (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient_id, Prescription.clinic_id == clinic_id)
        .all()
    ):
        # Not `names`: that map is the staff lookup built above, and rebinding
        # it here would empty every name for whatever ran afterwards.
        meds = [i.get("medicine_name") for i in (rx.items or []) if isinstance(i, dict)]
        add(
            rx.created_at, "prescription", "Prescription written",
            detail=", ".join(n for n in meds if n) or None,
            by=names.get(paper_dentist.get(rx.case_paper_id)), by_verb="By",
        )

    # ── Bills and money ──────────────────────────────────────────────────────
    invoices = (
        db.query(Invoice)
        .filter(Invoice.patient_id == patient_id, Invoice.clinic_id == clinic_id)
        .all()
    )
    for inv in invoices:
        add(
            inv.created_at, "invoice", "Invoice created",
            amount=float(inv.total or 0), reference=inv.invoice_number,
            by=_user_name(inv.creator), by_verb="Raised by", status=inv.status,
        )

    if invoices:
        for p in (
            db.query(InvoicePayment)
            .filter(InvoicePayment.invoice_id.in_([i.id for i in invoices]))
            .all()
        ):
            # created_at is when it was entered; paid_on is the day the money
            # arrived. An imported payment has only the second, and belongs in
            # the middle of the timeline rather than sunk to the bottom.
            add(
                p.created_at or p.paid_on, "payment", "Payment received",
                amount=float(p.amount or 0), method=p.method,
                reference=p.reference, by=_user_name(p.recorder),
                by_verb="Recorded by",
            )

    events.sort(key=lambda e: (e["at"], ORDER.get(e["kind"], 9)), reverse=True)
    return events[:limit]
