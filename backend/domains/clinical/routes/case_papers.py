from fastapi import APIRouter, HTTPException, Depends, status, Response
from sqlalchemy.orm import Session
from database import get_db
from models import (
    CasePaper, User, Appointment, Clinic, Patient,
    Invoice, LabOrder, Prescription, CaseCost, InventoryTransaction,
)
from schemas import CasePaperCreate, CasePaperUpdate, CasePaperOut
from core.auth_utils import get_current_user, require_doctor_or_owner
from typing import List, Optional, Any
from pydantic import BaseModel
import re
from datetime import datetime
import json

router = APIRouter(prefix="/case-papers", tags=["case-papers"])

@router.get("/patient/{patient_id}", response_model=List[CasePaperOut])
def get_patient_case_papers(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch all clinical case papers for a specific patient."""
    papers = db.query(CasePaper).filter(
        CasePaper.patient_id == patient_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).order_by(CasePaper.date.desc()).all()

    # Resolve the dentist's name onto each row. A bare dentist_id tells the case
    # paper list nothing, so every card read "Not assigned" even when the visit
    # plainly had a dentist. Set here rather than in the schema because FastAPI
    # reads attributes straight off the ORM object and never calls the schema's
    # own model_validate, so a classmethod override there is silently ignored.
    for paper in papers:
        paper.dentist_name = paper.dentist.name if paper.dentist else None

    return papers

@router.post("", response_model=CasePaperOut)
def create_case_paper(
    case_paper: CasePaperCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """Create a new clinical case paper for a patient visit."""
    # Serialize lists to JSON strings for Text columns
    data = case_paper.model_dump(exclude={"clinic_id"})
    if isinstance(data.get('chief_complaint'), list):
        data['chief_complaint'] = json.dumps(data['chief_complaint'])
    if isinstance(data.get('dental_history'), list):
        data['dental_history'] = json.dumps(data['dental_history'])

    # Drop a stale appointment link silently — FK is nullable, so a deleted
    # or wrong-clinic appointment_id should produce an unlinked case paper
    # rather than a 500 ForeignKeyViolation.
    if data.get("appointment_id") is not None:
        exists = db.query(Appointment.id).filter(
            Appointment.id == data["appointment_id"],
            Appointment.clinic_id == current_user.clinic_id
        ).first()
        if not exists:
            data["appointment_id"] = None

    db_paper = CasePaper(
        **data,
        clinic_id=current_user.clinic_id
    )
    db.add(db_paper)
    db.flush()

    # A case paper means the patient was in the clinic, so they belong in the
    # day's register even if reception never entered them. Idempotent per patient
    # per day, so someone already registered by hand isn't counted twice.
    # Best-effort: never block recording clinical work.
    try:
        from domains.patient.routes.daily_register import record_daily_visit
        reg_clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        reg_patient = db.query(Patient).filter(Patient.id == db_paper.patient_id).first()
        if reg_clinic and reg_patient:
            record_daily_visit(
                db, reg_clinic, reg_patient,
                source='case_paper',
                doctor_id=db_paper.dentist_id,
                created_by=current_user.id,
            )
    except Exception as e:
        print(f"⚠️ Could not add case paper {db_paper.id} to the daily register: {e}")

    # A case paper against an appointment is proof the patient was seen, so the
    # appointment is finished. Nothing used to write that: `completed` was read
    # by the stats and set only by somebody remembering to press it, so
    # appointments sat in `arrived` and the no-show rate had no denominator.
    #
    # Only ever moves an OPEN appointment to completed, and never marks anything
    # missed — see domains/scheduling/services/appointment_completion.py for why
    # that distinction is the whole design.
    #
    # Best-effort, same as the register above: recording clinical work must not
    # fail because a scheduling row would not update.
    try:
        if db_paper.appointment_id:
            # NB: no `from models import Appointment` here. Appointment is
            # already imported at module scope and used earlier in this
            # function; a local import rebinds the name for the WHOLE function,
            # so the earlier use becomes an unbound local and every case paper
            # 500s. It did, until this comment existed.
            from domains.scheduling.services.appointment_completion import (
                complete_appointment_if_open, SOURCE_CASE_PAPER,
            )
            appt = db.query(Appointment).filter(
                Appointment.id == db_paper.appointment_id,
                Appointment.clinic_id == current_user.clinic_id,
                Appointment.patient_id == db_paper.patient_id,
            ).first()
            complete_appointment_if_open(db, appt, current_user, SOURCE_CASE_PAPER)
    except Exception as e:
        print(f"⚠️ Could not complete appointment for case paper {db_paper.id}: {e}")

    db.commit()
    db.refresh(db_paper)
    return db_paper

@router.get("/{paper_id}", response_model=CasePaperOut)
def get_case_paper(
    paper_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch a specific case paper by ID."""
    paper = db.query(CasePaper).filter(
        CasePaper.id == paper_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Case paper not found")
    return paper

def _sync_fee(db, paper, actor_id):
    """Keep the treating doctor's fee in step with the case.

    Imported lazily so this module does not depend on the case-costs domain at
    import time; the fee is an add-on to the clinical record, not part of it.
    """
    try:
        from domains.clinical.routes.case_costs import sync_consultant_fee
        from models import Invoice
        inv = (
            db.query(Invoice)
            .filter(Invoice.case_paper_id == paper.id)
            .order_by(Invoice.created_at.desc())
            .first()
        )
        sync_consultant_fee(
            db, clinic_id=paper.clinic_id, patient_id=paper.patient_id,
            case_paper_id=paper.id, invoice_id=inv.id if inv else None,
            doctor_user_id=paper.dentist_id, actor_id=actor_id,
        )
    except Exception:  # noqa: BLE001 — never block a clinical save
        pass


@router.put("/{paper_id}", response_model=CasePaperOut)
def update_case_paper(
    paper_id: int,
    case_paper_update: CasePaperUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """Update clinical details in an existing case paper."""
    db_paper = db.query(CasePaper).filter(
        CasePaper.id == paper_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_paper:
        raise HTTPException(status_code=404, detail="Case paper not found")
        
    update_data = case_paper_update.model_dump(exclude_unset=True)
    
    # Serialize lists to JSON strings for Text columns
    if 'chief_complaint' in update_data and isinstance(update_data['chief_complaint'], list):
        update_data['chief_complaint'] = json.dumps(update_data['chief_complaint'])
    if 'dental_history' in update_data and isinstance(update_data['dental_history'], list):
        update_data['dental_history'] = json.dumps(update_data['dental_history'])
        
    for key, value in update_data.items():
        setattr(db_paper, key, value)
        
    db_paper.updated_at = datetime.utcnow()

    # The treating doctor may have just been set or changed, so the fee owed
    # for this case follows from their configured rate. Nobody types an amount.
    _sync_fee(db, db_paper, current_user.id)

    db.commit()
    db.refresh(db_paper)
    return db_paper

@router.delete("/{paper_id}")
def delete_case_paper(
    paper_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner())
):
    """Delete a clinical case paper, and say why when it cannot be deleted.

    Five tables point at case_papers, and this used to hand all of them to a
    bare `db.delete()`. Any paper with so much as one linked row raised a
    ForeignKeyViolation, which reached the front desk as a 500 with no
    explanation and no way to tell which record was in the way.

    The children are not equivalent, so they are not treated alike:

      * Invoices and lab orders BLOCK the delete. Both are commitments made
        outside this record — money a patient owes, work a lab has been asked
        for — and neither should vanish because somebody tidied up a visit, nor
        be silently cut loose from the visit that explains it.
      * Case costs are DELETED with it. A consultant's fee exists only to
        attribute this visit's work; with the visit gone it attributes nothing.
      * Prescriptions and stock movements are DETACHED. A prescription was
        handed to a patient and the stock really did leave the shelf; both
        outlive the paperwork, so they keep existing and lose the link.
    """
    db_paper = db.query(CasePaper).filter(
        CasePaper.id == paper_id,
        CasePaper.clinic_id == current_user.clinic_id
    ).first()

    if not db_paper:
        raise HTTPException(status_code=404, detail="Case paper not found")

    invoices = db.query(Invoice).filter(Invoice.case_paper_id == paper_id).count()
    lab_orders = db.query(LabOrder).filter(LabOrder.case_paper_id == paper_id).count()

    if invoices or lab_orders:
        blockers = []
        if invoices:
            blockers.append(f"{invoices} invoice{'s' if invoices != 1 else ''}")
        if lab_orders:
            blockers.append(f"{lab_orders} lab order{'s' if lab_orders != 1 else ''}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This visit has {' and '.join(blockers)} attached to it. "
                "Cancel or move those first, then delete the visit."
            ),
        )

    db.query(CaseCost).filter(CaseCost.case_paper_id == paper_id).delete(synchronize_session=False)
    db.query(Prescription).filter(Prescription.case_paper_id == paper_id).update(
        {Prescription.case_paper_id: None}, synchronize_session=False
    )
    db.query(InventoryTransaction).filter(InventoryTransaction.case_paper_id == paper_id).update(
        {InventoryTransaction.case_paper_id: None}, synchronize_session=False
    )

    db.delete(db_paper)
    db.commit()
    return {"message": "Case paper deleted successfully"}


# ── Visit summary ────────────────────────────────────────────────────────────
# The visit told to the patient rather than to the file. Lives here because it
# is a view of a case paper, not a thing of its own.

def _summary_pdf(db: Session, cp) -> bytes:
    import os
    from models import Clinic, User as U
    from domains.clinical.summary_pdf import render_summary
    from domains.infrastructure.services.pdf_service import html_template_to_pdf

    clinic = db.query(Clinic).filter(Clinic.id == cp.clinic_id).first()
    dentist = db.query(U).filter(U.id == cp.dentist_id).first() if cp.dentist_id else None
    # A clinic on the general case paper does not employ a "Dentist", and the
    # summary is signed off with a role the patient will recognise.
    is_dental = (getattr(clinic, "case_paper_type", None) or "dental") != "general"
    html = render_summary(cp, clinic, dentist.name if dentist else "", is_dental)
    path = html_template_to_pdf(html)
    try:
        with open(path, "rb") as fh:
            return fh.read()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def _load_paper(db: Session, paper_id: int, current_user):
    cp = db.query(CasePaper).filter(
        CasePaper.id == paper_id,
        CasePaper.clinic_id == current_user.clinic_id,
    ).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Case paper not found")
    return cp


@router.get("/{paper_id}/summary-pdf")
async def visit_summary_pdf(paper_id: int, db: Session = Depends(get_db),
                            current_user=Depends(get_current_user)):
    cp = _load_paper(db, paper_id, current_user)
    return Response(
        content=_summary_pdf(db, cp),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Visit_summary_{paper_id}.pdf"'},
    )


def _treatment_plan_pdf(db: Session, cp) -> bytes:
    import os
    from models import Clinic, User as U
    from domains.clinical.treatment_plan_pdf import render_treatment_plan
    from domains.infrastructure.services.pdf_service import html_template_to_pdf

    clinic = db.query(Clinic).filter(Clinic.id == cp.clinic_id).first()
    dentist = db.query(U).filter(U.id == cp.dentist_id).first() if cp.dentist_id else None
    html = render_treatment_plan(
        cp, clinic, cp.patient,
        dentist.name if dentist else "",
        getattr(clinic, "currency_symbol", None) or "₹",
    )
    path = html_template_to_pdf(html)
    try:
        with open(path, "rb") as fh:
            return fh.read()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


@router.get("/{paper_id}/treatment-plan-pdf")
async def treatment_plan_pdf(paper_id: int, db: Session = Depends(get_db),
                             current_user=Depends(get_current_user)):
    """The visit's treatment plan as a PDF the patient can be handed.

    Rendered from treatment_plan_snapshot, which is the plan as it stood on this
    case paper — not the patient's live plan. Sharing a document that quietly
    changes after it was sent is worse than not sharing one.

    No automated WhatsApp counterpart on purpose: that path bills wallet credit
    and needs a template approved before it delivers anything, so it would work
    for some clinics and silently fail for the rest. The frontend downloads this
    and opens WhatsApp for the clinic to attach it themselves.
    """
    cp = _load_paper(db, paper_id, current_user)
    return Response(
        content=_treatment_plan_pdf(db, cp),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Treatment_plan_{paper_id}.pdf"'},
    )


# ── AI-drafted clinical notes ────────────────────────────────────────────────

_NOTES_SYSTEM = """You write the clinical note for a dental visit, from the \
record the dentist has already entered.

Rules, in order of importance:

1. Never state a finding, tooth, medicine, measurement or diagnosis that is not \
   in the input. If something is not recorded, it did not happen. Do not infer, \
   do not complete a pattern, do not add the "obvious" next step.
2. Write what a colleague reading this file in two years needs: what was found, \
   what was decided, what was done, what happens next. Plain clinical prose.
3. Tooth numbers are given in FDI. Use them exactly as given.
4. No headings, no bullet points, no preamble. Three short paragraphs at most.
5. Do not give the patient advice or a prognosis the dentist has not recorded.

You are drafting, not deciding. The dentist reads and edits every word before it \
is saved."""

_NOTES_SCHEMA = {
    "type": "object",
    "properties": {
        "note": {"type": "string", "description": "The clinical note, plain prose."},
        "omitted": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Anything a complete note would normally carry that "
                           "the record does not contain, so the dentist can fill it in.",
        },
    },
    "required": ["note", "omitted"],
    "additionalProperties": False,
}


def _notes_input(cp, prescriptions) -> str:
    """Only what is recorded. Nothing derived, nothing assumed."""
    import json
    from domains.clinical.clinical_summary_pdf import (
        _as_list, _json_obj, CONDITION_WORDS, WORK_WORDS, TYPE_WORDS,
    )
    from domains.clinical.tooth_notation import universal_to_fdi, format_surfaces

    chart = _json_obj(getattr(cp, "dental_chart_snapshot", None), {}) or {}
    plan = _json_obj(getattr(cp, "treatment_plan_snapshot", None), []) or []
    notes_by_tooth = _json_obj(getattr(cp, "tooth_notes_snapshot", None), {}) or {}
    perio = _json_obj(getattr(cp, "perio_chart_snapshot", None), {}) or {}

    teeth = []
    for key, data in chart.items():
        if not isinstance(data, dict):
            continue
        marked = [k for k, v in (data.get("surfaces") or {}).items() if v and v != "none"]
        entry = {
            "tooth_fdi": universal_to_fdi(key),
            "condition": CONDITION_WORDS.get(data.get("condition")),
            "work": (f"{TYPE_WORDS.get(data.get('workType'), 'work')} "
                     f"({WORK_WORDS.get(data.get('work'), '')})") if data.get("work") else None,
            "surfaces": format_surfaces(key, marked) or None,
            "findings": data.get("findings") or None,
            "note": notes_by_tooth.get(str(key)) or None,
        }
        if any(v for k, v in entry.items() if k != "tooth_fdi"):
            teeth.append({k: v for k, v in entry.items() if v})

    procedures = [{
        "tooth_fdi": universal_to_fdi(i["tooth"]) if i.get("tooth") else
                     ([universal_to_fdi(t) for t in i["teeth"]] if i.get("teeth") else "general"),
        "procedure": i.get("procedure"),
        "diagnosis": i.get("diagnosis") or None,
        "status": i.get("status") or "planned",
    } for i in plan if isinstance(i, dict) and i.get("procedure")]

    medicines = [
        {k: it.get(k) for k in ("medicine_name", "dosage", "frequency", "duration") if it.get(k)}
        for rx in (prescriptions or []) for it in (rx.items or []) if (it or {}).get("medicine_name")
    ]

    record = {
        "visit_date": cp.date.strftime("%d %B %Y") if cp.date else None,
        "chief_complaint": _as_list(cp.chief_complaint) or None,
        "medical_history": _as_list(cp.medical_history) or None,
        "allergies": _as_list(cp.allergies) or None,
        "dental_history": _as_list(cp.dental_history) or None,
        "examination": cp.clinical_examination or None,
        "diagnosis": cp.diagnosis or None,
        "teeth": teeth or None,
        "procedures": procedures or None,
        "medicines_prescribed": medicines or None,
        "periodontal": {"bpe": perio.get("bpe"), "notes": perio.get("notes")} if perio else None,
        "next_visit": cp.next_visit_recommendation or None,
        "dentist_existing_note": cp.notes or None,
    }
    return json.dumps({k: v for k, v in record.items() if v}, indent=1, default=str)


@router.post("/{paper_id}/draft-notes")
async def draft_clinical_notes(paper_id: int, db: Session = Depends(get_db),
                               current_user=Depends(require_doctor_or_owner())):
    """Draft the visit's clinical note from what is already on the record.

    Returns a draft and never saves it. The dentist reads, edits and saves it
    themselves — a clinical record that writes itself unattended is a liability,
    not a feature, and the note is what a court or a colleague reads later.
    """
    import os
    import json
    from models import Prescription

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Note drafting isn't switched on for this server yet (missing ANTHROPIC_API_KEY).",
        )
    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        raise HTTPException(status_code=503, detail="Note drafting dependency is not installed.")

    cp = _load_paper(db, paper_id, current_user)
    prescriptions = db.query(Prescription).filter(Prescription.case_paper_id == cp.id).all()
    record = _notes_input(cp, prescriptions)

    if len(record) < 40:
        raise HTTPException(
            status_code=400,
            detail="There isn't enough on this case paper yet to draft a note from.",
        )

    # Its own variable, not the shared ANTHROPIC_MODEL: that one is pinned to a
    # small model for reading handwriting, and a clinical note is a judgement
    # task, not a transcription. `or` rather than getenv's default because
    # docker-compose passes the name through and it arrives empty when unset.
    model = os.getenv("ANTHROPIC_NOTES_MODEL") or "claude-opus-5"
    client = AsyncAnthropic(api_key=api_key)

    try:
        resp = await client.messages.create(
            model=model,
            max_tokens=16000,
            system=_NOTES_SYSTEM,
            output_config={
                "format": {"type": "json_schema", "schema": _NOTES_SCHEMA},
                "effort": "medium",
            },
            messages=[{"role": "user", "content":
                       f"The record for this visit:\n\n{record}\n\nWrite the clinical note."}],
        )
    except Exception as e:  # noqa: BLE001 — the drawer shows this, so it must read
        print(f"⚠️ Clinical note drafting failed for case paper {paper_id}: {e}")
        raise HTTPException(status_code=502, detail="Could not draft a note just now. Try again.")

    if getattr(resp, "stop_reason", None) == "refusal":
        raise HTTPException(status_code=502, detail="Could not draft a note for this record.")

    text = "".join(getattr(b, "text", "") for b in resp.content
                   if getattr(b, "type", None) == "text")
    try:
        parsed = json.loads(text) if text.strip() else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Could not draft a note just now. Try again.")

    return {
        "note": parsed.get("note", ""),
        "omitted": parsed.get("omitted", []),
        "model": model,
    }


# ── Clinical summary ─────────────────────────────────────────────────────────
# The whole visit, for the file rather than for the patient: chart, findings,
# plan, medicines, perio. See domains/clinical/clinical_summary_pdf.py.

_SVG_MAX_BYTES = 3_000_000

# Anything that could make the PDF renderer reach outside this request. The SVG
# arrives from the browser, and WeasyPrint will happily follow an <image href>
# or resolve an entity — so a chart from a tampered client could read a file off
# the server or call out to a URL. Strip the lot; the chart needs none of it.
_SVG_FORBIDDEN = re.compile(
    r"<\s*(script|foreignObject|image|use|iframe|object|embed|a)\b"
    r"|<!DOCTYPE|<!ENTITY|xlink:href\s*=|(?<!fill:url\(#)href\s*=|\bon[a-z]+\s*=",
    re.IGNORECASE,
)


def _safe_svg(svg: str) -> str:
    """The posted chart, or nothing. Never a half-cleaned version: a chart we
    cannot vouch for is worse than a page that says the chart is missing."""
    if not svg:
        return ""
    svg = svg.strip()
    if len(svg.encode("utf-8")) > _SVG_MAX_BYTES:
        return ""
    if not svg.startswith("<svg") or not svg.endswith("</svg>"):
        return ""
    if _SVG_FORBIDDEN.search(svg):
        return ""
    return svg


class ClinicalSummaryRequest(BaseModel):
    # The live chart, serialised by the browser. Optional: the endpoint still
    # produces a document without it, saying so rather than leaving a hole.
    chart_svg: Optional[str] = None


def _clinical_summary_pdf(db: Session, cp, chart_svg: str) -> bytes:
    import os
    from models import Clinic, User as U, Prescription, LabOrder, InventoryTransaction
    from domains.clinical.clinical_summary_pdf import render_clinical_summary
    from domains.infrastructure.services.pdf_service import html_template_to_pdf

    clinic = db.query(Clinic).filter(Clinic.id == cp.clinic_id).first()
    dentist = db.query(U).filter(U.id == cp.dentist_id).first() if cp.dentist_id else None

    prescriptions = db.query(Prescription).filter(Prescription.case_paper_id == cp.id).all()
    lab_orders = db.query(LabOrder).filter(LabOrder.case_paper_id == cp.id).all()
    consumptions = db.query(InventoryTransaction).filter(
        InventoryTransaction.case_paper_id == cp.id).all()

    html = render_clinical_summary(
        cp, clinic, cp.patient,
        dentist.name if dentist else "",
        getattr(clinic, "currency_symbol", None) or "₹",
        chart_svg=chart_svg,
        prescriptions=prescriptions,
        lab_orders=lab_orders,
        consumptions=consumptions,
    )
    path = html_template_to_pdf(html)
    try:
        with open(path, "rb") as fh:
            return fh.read()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


@router.post("/{paper_id}/clinical-summary-pdf")
async def clinical_summary_pdf(paper_id: int, payload: ClinicalSummaryRequest,
                               db: Session = Depends(get_db),
                               current_user=Depends(get_current_user)):
    """The full clinical record for this visit, as a PDF.

    POST rather than GET because the browser hands over the chart it is
    currently drawing. Rendering the chart a second time server-side would mean
    maintaining every one of its symbols twice, and the two would drift.
    """
    cp = _load_paper(db, paper_id, current_user)
    return Response(
        content=_clinical_summary_pdf(db, cp, _safe_svg(payload.chart_svg or "")),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Clinical_summary_{paper_id}.pdf"'},
    )


@router.post("/{paper_id}/send-summary")
async def send_visit_summary(paper_id: int, db: Session = Depends(get_db),
                             current_user=Depends(get_current_user)):
    """WhatsApp the visit summary to the patient.

    Manual rather than automatic on completion. A case paper is marked complete
    while the patient is still in the chair and often edited afterwards, so
    firing on that would send half-written summaries — and every send costs
    wallet credit. The clinic presses this when the note is actually finished.
    """
    from models import Clinic, NotificationPreference
    from core.notification_dispatch import notify_event, InsufficientWalletBalance

    cp = _load_paper(db, paper_id, current_user)
    if not cp.patient or not cp.patient.phone:
        raise HTTPException(status_code=400, detail="This patient has no phone number on file.")

    pref = db.query(NotificationPreference).filter(
        NotificationPreference.clinic_id == current_user.clinic_id,
        NotificationPreference.event_type == "treatment_summary",
    ).first()
    if not pref or not pref.is_enabled:
        return {"sent": False, "reason": "not_configured",
                "message": "Visit summaries aren't switched on for this clinic. "
                           "Download the PDF and send it yourself."}

    clinic = db.query(Clinic).filter(Clinic.id == cp.clinic_id).first()
    try:
        notify_event(
            "treatment_summary",
            db=db,
            clinic_id=current_user.clinic_id,
            to_phone=cp.patient.phone,
            to_name=cp.patient.name,
            required=True,
            template_data={
                "patient_name": cp.patient.name,
                "clinic_name": clinic.name if clinic else "",
                "visit_date": cp.date.strftime("%d %B %Y") if cp.date else "",
                "clinic_phone": getattr(clinic, "phone", "") or "",
            },
        )
    except InsufficientWalletBalance:
        raise
    return {"sent": True}
