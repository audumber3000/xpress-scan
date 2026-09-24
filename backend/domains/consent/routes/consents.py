from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import ConsentTemplate, PatientConsent, Patient, User
from core.dtos import (
    ConsentTemplateCreateDTO, 
    ConsentTemplateUpdateDTO, 
    ConsentTemplateResponseDTO,
    PatientConsentCreateDTO,
    PatientConsentResponseDTO
)
from core.auth_utils import get_current_user
from domains.consent.seed_consents import seed_clinic_consents
from domains.consent.rich_content import clean_for_storage
from domains.consent.library import LANGUAGES, LANGUAGE_CODES, library_forms, library_form

router = APIRouter()

# Template Routes
@router.get("/templates", response_model=List[ConsentTemplateResponseDTO])
def list_templates(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    clinic_id: Optional[int] = None
):
    target_clinic_id = clinic_id or current_user.clinic_id

    # The default forms land here rather than behind a "ready-made forms"
    # button. That button asked a dentist to go and find wording before the
    # section did anything, and a section that opens empty stays empty — which
    # meant consent went unrecorded. Now the list is never empty on a first
    # visit, and every row in it is an ordinary clinic row: editable, and
    # deletable for good. Lazy and once per clinic, so it reaches clinics that
    # already exist and never resurrects one that was deleted.
    seed_clinic_consents(db, target_clinic_id)

    templates = db.query(ConsentTemplate).filter(
        ConsentTemplate.clinic_id == target_clinic_id
    ).all()

    # One grouped count for the whole list, not one query per template. Lets the
    # documents tab rank templates by what the clinic actually uses instead of
    # showing them alphabetically forever.
    counts = dict(
        db.query(PatientConsent.template_id, func.count(PatientConsent.id))
        .filter(PatientConsent.clinic_id == target_clinic_id)
        .group_by(PatientConsent.template_id)
        .all()
    )
    for t in templates:
        t.usage_count = counts.get(t.id, 0)
    return templates


# /starter-library and /templates/adopt lived here. They backed the
# "Ready-made forms" picker, which is gone: the English defaults are seeded
# into the list instead. The library below is different: it is the same six
# forms in other languages, which are never seeded, only copied on request.


@router.get("/library")
def consent_library(
    language: str = "en",
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """The ready forms in one language, and which of them this clinic has.

    `added` matches on name, which is what a copy keeps, so a form the clinic
    added and later renamed shows as addable again. That is the honest answer:
    the clinic no longer has a form by that name.
    """
    if language not in LANGUAGE_CODES:
        raise HTTPException(status_code=400, detail="That language isn't in the library")
    have = {
        (n or "").strip().lower()
        for (n,) in db.query(ConsentTemplate.name).filter(
            ConsentTemplate.clinic_id == current_user.clinic_id
        ).all()
    }
    forms = library_forms(language)
    return {
        "languages": LANGUAGES,
        "language": language,
        "forms": [
            {**f, "added": f["name"].strip().lower() in have}
            for f in forms
        ],
    }


class LibraryAddRequest(BaseModel):
    language: str
    key: str


@router.post("/library/add", response_model=ConsentTemplateResponseDTO)
def add_from_library(
    payload: LibraryAddRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Copy a library form into the clinic, starred. Adding one it already
    has (same name) stars the existing copy instead of making a second."""
    form = library_form(payload.language, payload.key)
    if not form:
        raise HTTPException(status_code=404, detail="That form isn't in the library")

    existing = db.query(ConsentTemplate).filter(
        ConsentTemplate.clinic_id == current_user.clinic_id,
        func.lower(ConsentTemplate.name) == form["name"].strip().lower(),
    ).first()
    if existing:
        existing.is_favorite = True
        if existing.is_active is False:
            existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    template = ConsentTemplate(
        clinic_id=current_user.clinic_id,
        name=form["name"],
        category=form["category"],
        content=form["content"],
        language=form["language"],
        is_favorite=True,
        is_active=True,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


class FavoriteRequest(BaseModel):
    is_favorite: bool


@router.patch("/templates/{template_id}/favorite", response_model=ConsentTemplateResponseDTO)
def set_favorite(
    template_id: int,
    payload: FavoriteRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    template = db.query(ConsentTemplate).filter(
        ConsentTemplate.id == template_id,
        ConsentTemplate.clinic_id == current_user.clinic_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    template.is_favorite = payload.is_favorite
    db.commit()
    db.refresh(template)
    return template


@router.get("/signed")
async def list_signed_consents(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Every consent signed at this clinic.

    The signed record is the reason the feature exists and there was nowhere in
    the app to see one: the page listed templates and live links only.
    """
    rows = (
        db.query(PatientConsent, Patient, ConsentTemplate)
        .join(Patient, Patient.id == PatientConsent.patient_id)
        .outerjoin(ConsentTemplate, ConsentTemplate.id == PatientConsent.template_id)
        .filter(Patient.clinic_id == current_user.clinic_id)
        .order_by(PatientConsent.signed_at.desc().nullslast())
        .limit(200)
        .all()
    )
    return [{
        "id": c.id,
        "patient_id": p.id,
        "patient_name": p.name,
        "template_name": t.name if t else "Deleted template",
        "category": t.category if t else None,
        "signed_at": c.signed_at.isoformat() if c.signed_at else None,
        "has_signature": bool(c.signature_url),
    } for c, p, t in rows]


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Retire a template.

    Deactivated rather than deleted when it has been signed: destroying the
    template would leave those signed records pointing at nothing, and a
    consent record has to stay explicable years later.
    """
    template = db.query(ConsentTemplate).filter(
        ConsentTemplate.id == template_id,
        ConsentTemplate.clinic_id == current_user.clinic_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    signed = db.query(PatientConsent).filter(
        PatientConsent.template_id == template_id
    ).count()
    if signed:
        template.is_active = False
        db.commit()
        return {"message": f"Retired. {signed} signed form(s) still reference it, so it was kept."}

    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}


@router.get("/templates/{template_id}/preview")
async def preview_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Render a blank, printable consent form using the SAME engine that produces
    signed consents (consent_templates.classic) — so the preview matches the
    Template Settings letterhead exactly. Patient/signature fields render blank
    for the doctor to hand-fill. Returns { html }."""
    from models import Clinic, TemplateConfiguration
    from domains.consent.consent_templates import resolve_variant

    template = db.query(ConsentTemplate).filter(
        ConsentTemplate.id == template_id,
        ConsentTemplate.clinic_id == current_user.clinic_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    config = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == current_user.clinic_id,
        TemplateConfiguration.category == "consent",
    ).first()

    variant = resolve_variant("classic")
    html = variant["render"](
        clinic, "", "", template.name, template.content, "", config
    )
    return {"html": html}

@router.post("/templates", response_model=ConsentTemplateResponseDTO)
async def create_template(
    template_data: ConsentTemplateCreateDTO, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    data = template_data.dict()
    data["content"] = clean_for_storage(data.get("content"))
    if data.get("language") not in LANGUAGE_CODES:
        data["language"] = "en"
    if data.get("is_active") is None:
        data["is_active"] = True
    template = ConsentTemplate(
        clinic_id=current_user.clinic_id,
        **data
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.put("/templates/{template_id}", response_model=ConsentTemplateResponseDTO)
async def update_template(
    template_id: int,
    template_data: ConsentTemplateUpdateDTO,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    template = db.query(ConsentTemplate).filter(
        ConsentTemplate.id == template_id,
        ConsentTemplate.clinic_id == current_user.clinic_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    changes = template_data.dict(exclude_unset=True)
    if "content" in changes:
        changes["content"] = clean_for_storage(changes["content"])
    if "language" in changes and changes["language"] not in LANGUAGE_CODES:
        changes.pop("language")
    for key, value in changes.items():
        setattr(template, key, value)
    
    db.commit()
    db.refresh(template)
    return template

# Patient Consent Routes (Signing)
#
# Both of these were open. `GET /patient/{id}` answered 200 with no token at
# all, exposing any patient's signed consents across any clinic, and the POST
# accepted an unauthenticated write: a forged consent committed successfully
# and only errored afterwards, while serialising the response. A consent is a
# legal record, so both now require a signed-in user and both check the patient
# belongs to that user's clinic. Patients sign through the separate public link
# flow, which carries its own single-use token; this pair is staff-only.
@router.post("/patient/{patient_id}/sign", response_model=PatientConsentResponseDTO)
async def sign_consent(
    patient_id: int,
    consent_data: PatientConsentCreateDTO,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current_user.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # The template has to belong here too, or one clinic could attach another
    # clinic's wording to its own patient.
    template = db.query(ConsentTemplate).filter(
        ConsentTemplate.id == consent_data.template_id,
        ConsentTemplate.clinic_id == current_user.clinic_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Consent template not found")

    consent = PatientConsent(
        patient_id=patient_id,
        clinic_id=current_user.clinic_id,
        template_id=consent_data.template_id,
        signed_content=consent_data.signed_content,
        signature_url=consent_data.signature_url,
        signed_at=datetime.utcnow()
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    
    # Enrich with template name for response
    template = db.query(ConsentTemplate).filter(ConsentTemplate.id == consent.template_id).first()
    dto = PatientConsentResponseDTO.from_orm(consent)
    dto.template_name = template.name if template else "Template"
    return dto

@router.get("/patient/{patient_id}", response_model=List[PatientConsentResponseDTO])
async def list_patient_consents(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    patient = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.clinic_id == current_user.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    consents = db.query(PatientConsent).filter(
        PatientConsent.patient_id == patient_id,
    ).all()
    result = []
    for c in consents:
        template = db.query(ConsentTemplate).filter(ConsentTemplate.id == c.template_id).first()
        result.append(PatientConsentResponseDTO(
            id=c.id,
            patient_id=c.patient_id,
            template_id=c.template_id,
            template_name=template.name if template else "Template",
            signed_content=c.signed_content,
            signature_url=c.signature_url,
            signed_at=c.signed_at,
            created_at=c.created_at
        ))
    return result


# ── Creating a consent link ───────────────────────────────────────────────────

class ConsentLinkCreateRequest(BaseModel):
    template_id: int
    patient_id: int


@router.post("/links")
async def create_consent_link(
    payload: ConsentLinkCreateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Make a signing link for one patient and one form.

    The browser used to build this request for nexus itself, which meant the
    wording, the clinic and the patient's phone all came from the page. A
    patient with no phone number on file failed nexus validation and the page
    could only say "Failed to generate link". Built here from the database
    instead: the form and patient must belong to the caller's clinic, the
    wording is the stored copy, and a missing phone just means the link has to
    be shared by hand rather than sent on WhatsApp.
    """
    import os
    import httpx

    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with your account")
    template = db.query(ConsentTemplate).filter(
        ConsentTemplate.id == payload.template_id,
        ConsentTemplate.clinic_id == current_user.clinic_id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="That consent form no longer exists")
    patient = db.query(Patient).filter(
        Patient.id == payload.patient_id,
        Patient.clinic_id == current_user.clinic_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    nexus = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{nexus}/api/v1/consent/generate", json={
                "patientId": patient.id,
                "patientName": patient.name or "Patient",
                "phone": patient.phone or "",
                "templateId": template.id,
                "templateName": template.name,
                "content": template.content,
                "clinicId": current_user.clinic_id,
            })
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach the signing service. Please try again.")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not create the link. Please try again.")
    data = resp.json() or {}
    return {
        "token": data.get("token"),
        "sign_url": data.get("signUrl"),
        "expires_in": data.get("expires_in", 300),
        "patient": {"id": patient.id, "name": patient.name, "phone": patient.phone or ""},
    }


# ── Sending a consent link on WhatsApp ────────────────────────────────────────

class ConsentLinkWhatsAppRequest(BaseModel):
    consentLink: str


@router.post("/links/{token}/send-whatsapp")
async def send_consent_link_whatsapp(
    token: str,
    payload: ConsentLinkWhatsAppRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Send an already-generated consent link to the patient on WhatsApp.

    The link used to go straight from the browser to nexus, which always sent
    it through MSG91: the one patient message that ignored a clinic's own
    connected number. It now comes through here, so the clinic's number is
    used when it is connected. Otherwise this makes exactly the call the
    browser used to make, and the patient gets the same MSG91 message as before.

    Consent tokens live in nexus (Redis), so nexus validates the token, and it
    must belong to the caller's own clinic.
    """
    import os
    import httpx
    from models import Clinic
    from core.phone import normalize_phone
    from domains.notification.services import wareach_service

    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="No clinic associated with your account")
    link = (payload.consentLink or "").strip()
    if not link.startswith(("http://", "https://")) or token not in link:
        raise HTTPException(status_code=400, detail="That is not this consent form's link")

    nexus = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            check = await client.get(f"{nexus}/api/v1/consent/validate/{token}")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not send that WhatsApp message. Please try again.")
    if check.status_code == 404:
        raise HTTPException(status_code=404, detail="Link expired or invalid.")
    if check.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not send that WhatsApp message. Please try again.")
    data = (check.json() or {}).get("data") or {}
    if str(data.get("clinicId")) != str(current_user.clinic_id):
        raise HTTPException(status_code=404, detail="Link expired or invalid.")

    integration = wareach_service.get_active_integration(db, current_user.clinic_id)
    if integration:
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        phone = normalize_phone(data.get("phone", ""), clinic.country if clinic else None)
        if not phone:
            raise HTTPException(status_code=400, detail="This patient has no phone number to send to.")
        wareach_service.send_event(
            db,
            clinic_id=current_user.clinic_id,
            event_type="consent_form",
            phone=phone,
            data={
                "patient_name": data.get("patientName", ""),
                "clinic_name": (clinic.name if clinic else "") or "",
                "consent_link": link,
                "procedure_name": data.get("templateName", ""),
                "clinic_phone": (clinic.phone if clinic else "") or "",
            },
            integration=integration,
        )
        return {"success": True, "token": token, "provider": "wareach"}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{nexus}/api/v1/consent/send-whatsapp/{token}", json={"consentLink": link},
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not send that WhatsApp message. Please try again.")
    if resp.status_code != 200:
        try:
            detail = resp.json().get("detail")
        except Exception:
            detail = None
        raise HTTPException(status_code=resp.status_code, detail=detail or "Failed to send WhatsApp message")
    return resp.json()
