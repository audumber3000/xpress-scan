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
from domains.consent.starter_templates import CATEGORIES, STARTER_TEMPLATES

router = APIRouter()

# Template Routes
@router.get("/templates", response_model=List[ConsentTemplateResponseDTO])
async def list_templates(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    clinic_id: Optional[int] = None
):
    target_clinic_id = clinic_id or current_user.clinic_id
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


@router.get("/starter-library")
async def starter_library(current_user = Depends(get_current_user)):
    """Ready-made consent wording a clinic can adopt and edit.

    Declared above /templates/{id}/... routes is unnecessary here (different
    path root) but the ordering rule still applies to anything under
    /templates: a literal must precede a parameter route.
    """
    return {
        "categories": CATEGORIES,
        "templates": [
            {"name": t["name"], "category": t["category"],
             "preview": t["content"][:180], "content": t["content"]}
            for t in STARTER_TEMPLATES
        ],
    }


@router.post("/templates/adopt")
async def adopt_starter_templates(
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Copy chosen starter templates into this clinic.

    Copied, not referenced: the clinic owns the wording from that moment and
    editing it must never change anyone else's, nor should a later change here
    silently alter a form a clinic has already reviewed.
    """
    wanted = set(payload.get("names") or [])
    chosen = [t for t in STARTER_TEMPLATES if not wanted or t["name"] in wanted]

    existing = {
        n for (n,) in db.query(ConsentTemplate.name).filter(
            ConsentTemplate.clinic_id == current_user.clinic_id
        ).all()
    }

    created = []
    for t in chosen:
        if t["name"] in existing:
            continue  # idempotent: adopting twice must not duplicate
        row = ConsentTemplate(
            clinic_id=current_user.clinic_id,
            name=t["name"], content=t["content"], category=t["category"],
            is_active=True,
        )
        db.add(row)
        created.append(t["name"])
    db.commit()
    return {"created": created, "skipped": sorted(existing & {t["name"] for t in chosen})}


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
    template = ConsentTemplate(
        clinic_id=current_user.clinic_id,
        **template_data.dict()
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
    
    for key, value in template_data.dict(exclude_unset=True).items():
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
