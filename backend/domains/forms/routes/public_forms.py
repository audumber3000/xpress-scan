"""The patient's half: open a link on a phone, answer, sign, submit.

Unauthenticated by design — the token IS the credential, so everything here is
scoped by it and nothing accepts an id. Three rules follow from that and are
enforced on every route:

  * the token is the only lookup key, never a patient or submission id;
  * an expired or already-answered token is refused, so a forwarded WhatsApp
    message is not a permanent door into somebody's record;
  * the response carries the patient's first name only. Enough for them to know
    the form is theirs, not enough to be worth guessing tokens for.

A medical history adds a step in the middle. The patient sees the finished
document, with their own signature on it, before it is filed — because they are
signing a legal record and "submit and hope" is not informed consent. Preview
renders and returns the PDF without storing anything; submit renders it again
from the answers it is given and stores that. Nothing is kept between the two
calls, so a preview that is never submitted leaves no trace.
"""
import hashlib
import io
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import FormSubmission, Clinic, Patient, PatientDocument, TemplateConfiguration
from domains.forms.routes.forms import _is_expired, LAYOUT_TYPES

router = APIRouter()


class SubmitDTO(BaseModel):
    answers: Dict[str, Any]


def _load(db: Session, token: str) -> FormSubmission:
    sub = db.query(FormSubmission).filter(FormSubmission.token == token).first()
    # Same message either way: a wrong token and an expired one must not be
    # distinguishable, or the endpoint becomes a way to test tokens.
    if not sub or _is_expired(sub):
        raise HTTPException(404, "This link has expired or is not valid.")
    return sub


def _open_or_409(sub: FormSubmission) -> None:
    if sub.status in ("submitted", "applied"):
        raise HTTPException(409, "This form has already been filled in.")


def _is_medical(sub: FormSubmission) -> bool:
    return (sub.template.kind if sub.template else None) == "medical_history"


def _clean_answers(sub: FormSubmission, raw: Optional[dict]) -> dict:
    """Keep only what the patient was actually asked, then check what is missing.

    The body is public input. A stray key would otherwise be stored and shown to
    staff as though the patient had been asked for it, and a missing required
    answer would produce a signed document with a hole in it.
    """
    schema = sub.schema_snapshot or []
    known = {f["key"] for f in schema if f["type"] not in LAYOUT_TYPES}
    answers = {k: v for k, v in (raw or {}).items() if k in known}

    missing = [f["label"] for f in schema
               if f.get("required") and f["type"] not in LAYOUT_TYPES
               and _unanswered(f, answers.get(f["key"]))]
    if missing:
        raise HTTPException(400, f"Please answer: {', '.join(missing)}")
    return answers


def _unanswered(field, value) -> bool:
    """Whether a value counts as no answer, per field type.

    `yes_no_explain` is the one that needs its own rule: it arrives as a dict,
    and a dict with an empty `answer` is as unanswered as no dict at all even
    though it is truthy.
    """
    if field["type"] == "yes_no_explain":
        return not (isinstance(value, dict) and (value.get("answer") or "").strip())
    return value in (None, "", [], False)


def _render_pdf(db: Session, sub: FormSubmission, answers: dict,
                submitted_at: datetime, signed_ip: Optional[str] = None) -> bytes:
    """The finished document, from the frozen schema and these answers."""
    clinic = db.query(Clinic).filter(Clinic.id == sub.clinic_id).first()
    patient = sub.patient
    config = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == sub.clinic_id,
        # Deliberately the consent config: a clinic sets its letterhead once and
        # both documents it sends a patient come out matching.
        TemplateConfiguration.category == "consent",
    ).first()

    schema = sub.schema_snapshot or []
    sig_field = next((f for f in schema if f["type"] == "signature"), None)
    signature = answers.get(sig_field["key"]) if sig_field else None

    from domains.forms.form_templates import resolve_variant
    variant = resolve_variant("classic")
    html = variant["render"](
        clinic=clinic,
        patient_name=(patient.name if patient else ""),
        patient_id=sub.patient_id,
        template_name=(sub.template.name if sub.template else "Medical history"),
        schema=schema,
        answers=answers,
        signature_base64=signature,
        config=config,
        submitted_at=submitted_at,
        reference=f"MF-{sub.id}",
        signed_ip=signed_ip,
    )

    try:
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(500, "Document rendering is unavailable right now.")

    buf = io.BytesIO()
    HTML(string=html).write_pdf(target=buf, presentational_hints=True)
    return buf.getvalue()


@router.get("/{token}")
async def open_form(token: str, db: Session = Depends(get_db)):
    sub = _load(db, token)
    _open_or_409(sub)

    if sub.status == "sent":
        sub.opened_at = datetime.utcnow()
        sub.status = "opened"
        db.commit()

    clinic = db.query(Clinic).filter(Clinic.id == sub.clinic_id).first()
    first_name = (sub.patient.name or "").split(" ")[0] if sub.patient else ""

    return {
        "form_name": sub.template.name if sub.template else "Medical form",
        "clinic_name": clinic.name if clinic else "",
        "patient_first_name": first_name,
        # The phone decides whether to show the review-the-document step, so it
        # has to know which kind of form it opened.
        "kind": (sub.template.kind if sub.template else None) or "questionnaire",
        "schema": sub.schema_snapshot or [],
    }


@router.post("/{token}/preview")
async def preview_form(token: str, payload: SubmitDTO, db: Session = Depends(get_db)):
    """The document the patient is about to sign off on, rendered but not filed.

    Nothing is written here, not even the answers: a patient who previews and
    then closes the tab has submitted nothing, which is the behaviour the button
    promises. Restricted to medical histories because a questionnaire produces
    no document to look at.
    """
    sub = _load(db, token)
    _open_or_409(sub)
    if not _is_medical(sub):
        raise HTTPException(400, "This form has no document to preview.")

    answers = _clean_answers(sub, payload.answers)
    pdf = _render_pdf(db, sub, answers, datetime.utcnow())
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="medical-form-preview.pdf"'},
    )


@router.post("/{token}/submit")
async def submit_form(token: str, payload: SubmitDTO, request: Request,
                      db: Session = Depends(get_db)):
    sub = _load(db, token)
    _open_or_409(sub)

    answers = _clean_answers(sub, payload.answers)
    now = datetime.utcnow()

    if _is_medical(sub):
        _file_signed_copy(db, sub, answers, now, request)

    sub.answers = answers
    sub.status = "submitted"
    sub.submitted_at = now
    # Burn the token. The record stays, the door closes.
    sub.token = None
    db.commit()

    return {"ok": True, "message": "Thank you. Your form has been sent to the clinic."}


def _file_signed_copy(db: Session, sub: FormSubmission, answers: dict,
                      now: datetime, request: Request) -> None:
    """Render the signed history and file it on the patient's documents.

    Storage failing must not lose the answers. The patient has filled in a long
    form once and will not do it again, so a dead R2 leaves the submission
    recorded without a PDF rather than throwing the whole thing away — staff can
    still read every answer, and the missing document is visible as such.
    """
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() \
        or (request.client.host if request.client else None)
    agent = (request.headers.get("user-agent") or "")[:400]

    schema = sub.schema_snapshot or []
    sig_field = next((f for f in schema if f["type"] == "signature"), None)
    if sig_field:
        sub.signature_data = answers.get(sig_field["key"])
    sub.signed_ip = ip
    sub.signed_user_agent = agent

    try:
        pdf = _render_pdf(db, sub, answers, now, signed_ip=ip)
    except HTTPException:
        raise
    except Exception:
        return

    sub.pdf_sha256 = hashlib.sha256(pdf).hexdigest()

    from domains.infrastructure.services.r2_storage import (
        upload_bytes_to_r2, StorageCategory,
    )
    filename = f"medical_form_{sub.patient_id}_{int(now.timestamp())}.pdf"
    key = upload_bytes_to_r2(
        data=pdf, filename=filename, content_type="application/pdf",
        clinic_id=sub.clinic_id, patient_id=sub.patient_id,
        category=StorageCategory.CONSENTS,
    )
    if not key:
        return

    sub.pdf_key = key
    doc = PatientDocument(
        patient_id=sub.patient_id,
        clinic_id=sub.clinic_id,
        file_name=filename,
        file_path=key,
        file_size=len(pdf),
        file_type="pdf",
        created_at=now,
    )
    db.add(doc)
    db.flush()          # so the submission can point at the row it just made
    sub.document_id = doc.id
