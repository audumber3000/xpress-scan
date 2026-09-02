"""Patient forms: templates a clinic keeps, and the answers patients send back.

The delivery half of this problem was already solved by consents — mint a token,
WhatsApp the link, patient opens it on their phone. This reuses that shape but
keeps the token in Postgres on the submission row rather than in Redis.

Why the difference: the submission row has to exist anyway (a clinic needs to
see what was sent and when, and an expired Redis key must not erase that), the
answers have to be written by this service because they land on Patient columns,
and a token in the row means no cross-service hop and no shared secret on the
patient's path. Expiry and single-use are a timestamp and a status instead of a
TTL, which is the same guarantee with one fewer thing to be down.
"""
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import FormTemplate, FormSubmission, Patient, User
from core.auth_utils import get_current_user
from domains.forms.starter_forms import CATEGORIES, STARTER_FORMS, MAPPABLE_FIELDS
from core.notification_dispatch import notify_event, InsufficientWalletBalance

router = APIRouter()

# How long a patient has to fill the form in. Matches the consent link, for the
# same reason: long enough to survive being opened the next morning, short
# enough that a forwarded link is not a permanent way into a patient's record.
LINK_TTL = timedelta(hours=24)

FIELD_TYPES = {"text", "textarea", "boolean", "single_select",
               "multi_select", "date", "signature"}


# ── DTOs ──────────────────────────────────────────────────────────────────────

class FormFieldDTO(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    label: str = Field(..., min_length=1, max_length=300)
    type: str
    required: bool = False
    options: Optional[List[str]] = None
    maps_to: Optional[str] = None
    help: Optional[str] = None


class FormTemplateCreateDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = None
    case_paper_type: Optional[str] = Field(None, pattern="^(dental|general)$")
    schema: List[FormFieldDTO] = []
    is_active: bool = True


class FormTemplateResponseDTO(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    case_paper_type: Optional[str] = None
    schema: list = []
    is_active: bool = True

    class Config:
        from_attributes = True


class SendFormDTO(BaseModel):
    template_id: int


class ApplyAnswersDTO(BaseModel):
    # Which mapped fields the reviewer accepted. Nothing is applied that is not
    # named here, so "accept all" is the caller listing them all rather than a
    # default that quietly overwrites.
    accept_keys: List[str] = []


def _validate_schema(fields) -> list:
    """Reject a schema before it can be sent to a patient.

    A bad `type` renders as nothing on the phone and a bad `maps_to` would aim
    an answer at a column the clinic never intended, so both are closed sets and
    both are checked here rather than at render time.
    """
    out = []
    seen = set()
    for f in fields:
        d = f.model_dump() if hasattr(f, "model_dump") else dict(f)
        if d["type"] not in FIELD_TYPES:
            raise HTTPException(400, f"Unknown field type: {d['type']}")
        if d.get("maps_to") and d["maps_to"] not in MAPPABLE_FIELDS:
            raise HTTPException(400, f"Field cannot write to: {d['maps_to']}")
        if d["key"] in seen:
            raise HTTPException(400, f"Duplicate field key: {d['key']}")
        seen.add(d["key"])
        out.append(d)
    return out


# ── Templates ─────────────────────────────────────────────────────────────────

@router.get("/starter-library")
async def starter_library(current_user: User = Depends(get_current_user)):
    """Ready-made forms a clinic can adopt and edit."""
    return {
        "categories": CATEGORIES,
        "mappable_fields": MAPPABLE_FIELDS,
        "forms": [
            {"name": f["name"], "category": f["category"],
             "case_paper_type": f["case_paper_type"],
             "field_count": len(f["schema"]), "schema": f["schema"]}
            for f in STARTER_FORMS
        ],
    }


@router.get("/templates", response_model=List[FormTemplateResponseDTO])
async def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(FormTemplate)
        .filter(FormTemplate.clinic_id == current_user.clinic_id)
        .order_by(FormTemplate.name)
        .all()
    )


@router.post("/templates/adopt", response_model=List[FormTemplateResponseDTO])
async def adopt_starters(
    names: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Copy starter forms into this clinic. Re-adopting one is a no-op rather
    than a duplicate, so the button is safe to press twice."""
    existing = {
        n for (n,) in db.query(FormTemplate.name)
        .filter(FormTemplate.clinic_id == current_user.clinic_id).all()
    }
    created = []
    for starter in STARTER_FORMS:
        if starter["name"] not in names or starter["name"] in existing:
            continue
        t = FormTemplate(
            clinic_id=current_user.clinic_id,
            name=starter["name"],
            category=starter["category"],
            case_paper_type=starter["case_paper_type"],
            schema=starter["schema"],
        )
        db.add(t)
        created.append(t)
    db.commit()
    for t in created:
        db.refresh(t)
    return created


@router.post("/templates", response_model=FormTemplateResponseDTO)
async def create_template(
    payload: FormTemplateCreateDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = FormTemplate(
        clinic_id=current_user.clinic_id,
        name=payload.name,
        category=payload.category,
        case_paper_type=payload.case_paper_type,
        schema=_validate_schema(payload.schema),
        is_active=payload.is_active,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.put("/templates/{template_id}", response_model=FormTemplateResponseDTO)
async def update_template(
    template_id: int,
    payload: FormTemplateCreateDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(FormTemplate).filter(
        FormTemplate.id == template_id,
        FormTemplate.clinic_id == current_user.clinic_id,
    ).first()
    if not t:
        raise HTTPException(404, "Form not found")
    t.name = payload.name
    t.category = payload.category
    t.case_paper_type = payload.case_paper_type
    t.schema = _validate_schema(payload.schema)
    t.is_active = payload.is_active
    db.commit()
    db.refresh(t)
    return t


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(FormTemplate).filter(
        FormTemplate.id == template_id,
        FormTemplate.clinic_id == current_user.clinic_id,
    ).first()
    if not t:
        raise HTTPException(404, "Form not found")
    # Submissions keep their own schema_snapshot, so deleting the template does
    # not destroy the record of what a patient was asked. Deactivate instead of
    # deleting when it has been used, so the history stays joinable.
    used = db.query(FormSubmission).filter(FormSubmission.template_id == template_id).count()
    if used:
        t.is_active = False
        db.commit()
        return {"deleted": False, "deactivated": True, "submissions": used}
    db.delete(t)
    db.commit()
    return {"deleted": True}


# ── Sending, and reading what came back ───────────────────────────────────────

@router.post("/patient/{patient_id}/send")
async def send_form(
    patient_id: int,
    payload: SendFormDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mint a link for this patient and record that it was sent.

    The WhatsApp send is a separate call, so a clinic with no wallet balance
    still gets a link it can copy and hand over.
    """
    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current_user.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    template = db.query(FormTemplate).filter(
        FormTemplate.id == payload.template_id,
        FormTemplate.clinic_id == current_user.clinic_id,
    ).first()
    if not template:
        raise HTTPException(404, "Form not found")

    sub = FormSubmission(
        clinic_id=current_user.clinic_id,
        patient_id=patient_id,
        template_id=template.id,
        token=secrets.token_urlsafe(32),
        # Frozen: editing the template later must not change what this patient
        # was asked, nor what their stored answers line up against.
        schema_snapshot=template.schema,
        status="sent",
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "token": sub.token, "patient_name": patient.name,
            "form_name": template.name, "expires_in_hours": int(LINK_TTL.total_seconds() // 3600)}


@router.get("/patient/{patient_id}")
async def list_for_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subs = (
        db.query(FormSubmission)
        .filter(
            FormSubmission.patient_id == patient_id,
            FormSubmission.clinic_id == current_user.clinic_id,
        )
        .order_by(FormSubmission.sent_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "template_id": s.template_id,
            "form_name": s.template.name if s.template else None,
            "status": s.status,
            "sent_at": s.sent_at.isoformat() if s.sent_at else None,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "applied_at": s.applied_at.isoformat() if s.applied_at else None,
            "expired": _is_expired(s),
        }
        for s in subs
    ]


def _is_expired(sub: FormSubmission) -> bool:
    """Only an unanswered link expires. Once the patient has submitted, the
    record is permanent — the TTL is on the way in, not on the answers."""
    if sub.status in ("submitted", "applied"):
        return False
    if not sub.sent_at:
        return False
    return datetime.utcnow() - sub.sent_at > LINK_TTL


@router.get("/submissions/{submission_id}")
async def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One submission, with each mapped answer shown against what is on file.

    The comparison is the point of the review step: staff decide per field, and
    a field whose answer already matches the chart needs no decision at all.
    """
    sub = db.query(FormSubmission).filter(
        FormSubmission.id == submission_id,
        FormSubmission.clinic_id == current_user.clinic_id,
    ).first()
    if not sub:
        raise HTTPException(404, "Submission not found")

    answers = sub.answers or {}
    schema = sub.schema_snapshot or []
    patient = sub.patient

    mapped = []
    for f in schema:
        target = f.get("maps_to")
        if not target:
            continue
        proposed = answers.get(f["key"])
        if isinstance(proposed, list):
            proposed = ", ".join(str(x) for x in proposed)
        current = getattr(patient, target, None)
        current = current.isoformat() if hasattr(current, "isoformat") else current
        mapped.append({
            "key": f["key"], "label": f["label"], "maps_to": target,
            "maps_to_label": MAPPABLE_FIELDS.get(target, target),
            "proposed": proposed,
            "current": current,
            "same": (str(proposed or "").strip() == str(current or "").strip()),
        })

    return {
        "id": sub.id,
        "patient_id": sub.patient_id,
        "patient_name": patient.name if patient else None,
        "form_name": sub.template.name if sub.template else None,
        "status": sub.status,
        "sent_at": sub.sent_at.isoformat() if sub.sent_at else None,
        "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
        "applied_at": sub.applied_at.isoformat() if sub.applied_at else None,
        "schema": schema,
        "answers": answers,
        "mapped": mapped,
    }


@router.post("/submissions/{submission_id}/apply")
async def apply_answers(
    submission_id: int,
    payload: ApplyAnswersDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Write the accepted answers onto the patient.

    Only fields named in `accept_keys` move, and only fields that carry a
    `maps_to` in the frozen schema. Everything else stays on the submission,
    which is where a patient's free text belongs until somebody has read it.
    """
    sub = db.query(FormSubmission).filter(
        FormSubmission.id == submission_id,
        FormSubmission.clinic_id == current_user.clinic_id,
    ).first()
    if not sub:
        raise HTTPException(404, "Submission not found")
    if sub.status not in ("submitted", "applied"):
        raise HTTPException(400, "This form has not been filled in yet.")

    answers = sub.answers or {}
    by_key = {f["key"]: f for f in (sub.schema_snapshot or []) if f.get("maps_to")}
    patient = sub.patient
    applied = []

    for key in payload.accept_keys:
        field = by_key.get(key)
        if not field:
            continue
        value = answers.get(key)
        if isinstance(value, list):
            value = ", ".join(str(x) for x in value)
        if value in (None, ""):
            continue
        setattr(patient, field["maps_to"], value)
        applied.append(field["maps_to"])

    sub.status = "applied"
    sub.applied_at = datetime.utcnow()
    sub.reviewed_by = current_user.id
    db.commit()
    return {"applied": applied, "count": len(applied)}


class SendWhatsAppDTO(BaseModel):
    submission_id: int
    # Where the patient's link lives. Passed by the caller rather than built
    # here because the app is served from a different host than the API, and
    # the backend has no reliable way to know which one a given clinic uses.
    app_origin: str = Field(..., max_length=200)


@router.post("/send-whatsapp")
async def send_form_whatsapp(
    payload: SendWhatsAppDTO,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """WhatsApp the link for a submission that has already been created.

    Separate from /send on purpose: the link exists whether or not the message
    goes out, so a clinic with an empty wallet still has something to hand the
    patient. required=True because here the send IS the request — a silent
    failure would leave staff believing the patient had been messaged.
    """
    sub = db.query(FormSubmission).filter(
        FormSubmission.id == payload.submission_id,
        FormSubmission.clinic_id == current_user.clinic_id,
    ).first()
    if not sub:
        raise HTTPException(404, "Form not found")
    if not sub.token:
        raise HTTPException(400, "This form has already been filled in.")
    if _is_expired(sub):
        raise HTTPException(400, "This link has expired. Send the form again.")

    patient = sub.patient
    if not patient or not patient.phone:
        raise HTTPException(400, "This patient has no phone number on file.")

    # notify_event returns quietly when the clinic has no preference row for an
    # event, which is every clinic until this one is seeded. Reporting "sent" on
    # that is worse than failing: staff stop chasing a patient who was never
    # messaged. Checked here so the answer can say what actually happened.
    from models import NotificationPreference
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.clinic_id == current_user.clinic_id,
        NotificationPreference.event_type == "patient_form",
    ).first()
    if not pref or not pref.is_enabled:
        return {
            "sent": False,
            "reason": "not_configured",
            "message": "Patient form messages aren't switched on for this clinic. "
                       "The link above still works — copy it and send it yourself.",
        }

    origin = payload.app_origin.rstrip("/")
    try:
        notify_event(
            "patient_form",
            db=db,
            clinic_id=current_user.clinic_id,
            to_phone=patient.phone,
            to_name=patient.name,
            required=True,
            template_data={
                "patient_name": patient.name,
                "clinic_name": (sub.clinic.name if sub.clinic else ""),
                "form_name": (sub.template.name if sub.template else ""),
                "form_link": f"{origin}/form/fill/{sub.token}",
                "clinic_phone": (sub.clinic.phone if sub.clinic else ""),
            },
        )
    except InsufficientWalletBalance:
        raise
    return {"sent": True}
