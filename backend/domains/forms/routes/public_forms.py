"""The patient's half: open a link on a phone, answer, submit.

Unauthenticated by design — the token IS the credential, so everything here is
scoped by it and nothing accepts an id. Three rules follow from that and are
enforced on every route:

  * the token is the only lookup key, never a patient or submission id;
  * an expired or already-answered token is refused, so a forwarded WhatsApp
    message is not a permanent door into somebody's record;
  * the response carries the patient's first name only. Enough for them to know
    the form is theirs, not enough to be worth guessing tokens for.
"""
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import FormSubmission, Clinic
from domains.forms.routes.forms import _is_expired

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


@router.get("/{token}")
async def open_form(token: str, db: Session = Depends(get_db)):
    sub = _load(db, token)
    if sub.status in ("submitted", "applied"):
        raise HTTPException(409, "This form has already been filled in.")

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
        "schema": sub.schema_snapshot or [],
    }


@router.post("/{token}/submit")
async def submit_form(token: str, payload: SubmitDTO, db: Session = Depends(get_db)):
    sub = _load(db, token)
    if sub.status in ("submitted", "applied"):
        raise HTTPException(409, "This form has already been filled in.")

    schema = sub.schema_snapshot or []
    known = {f["key"] for f in schema}
    # Drop anything not in the frozen schema. The body is public input, and a
    # stray key would otherwise be stored and shown to staff as if the patient
    # had been asked for it.
    answers = {k: v for k, v in (payload.answers or {}).items() if k in known}

    missing = [
        f["label"] for f in schema
        if f.get("required") and answers.get(f["key"]) in (None, "", [], False)
    ]
    if missing:
        raise HTTPException(400, f"Please answer: {', '.join(missing)}")

    sub.answers = answers
    sub.status = "submitted"
    sub.submitted_at = datetime.utcnow()
    # Burn the token. The record stays, the door closes.
    sub.token = None
    db.commit()

    return {"ok": True, "message": "Thank you. Your form has been sent to the clinic."}
