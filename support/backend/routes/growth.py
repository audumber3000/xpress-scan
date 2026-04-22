import csv
import datetime
import io
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import GrowthLead, GrowthLeadActivity, Clinic, Base
from routes.auth import get_current_admin

router = APIRouter()

STAGES = [
    "new_lead",
    "contact_attempted",
    "connected",
    "demo_scheduled",
    "demo_done",
    "trial_started",
    "trial_active",
    "trial_expired",
    "negotiation",
    "won",
    "lost",
    "nurture",
]

CONVERSION_CHAIN = ["new_lead", "connected", "demo_done", "trial_active", "won"]


def _ensure_growth_tables(db: Session):
    Base.metadata.create_all(bind=db.bind, tables=[GrowthLead.__table__, GrowthLeadActivity.__table__])


def _dt(value):
    if not value:
        return None
    if isinstance(value, datetime.datetime):
        return value
    return datetime.datetime.fromisoformat(value)


def _lead_to_dict(lead: GrowthLead, clinic_name: str = None):
    return {
        "id": lead.id,
        "clinic_id": lead.clinic_id,
        "clinic_name": clinic_name,
        "lead_name": lead.lead_name,
        "contact_person": lead.contact_person,
        "phone": lead.phone,
        "email": lead.email,
        "source": lead.source,
        "stage": lead.stage,
        "owner": lead.owner,
        "priority": lead.priority,
        "expected_mrr": lead.expected_mrr,
        "trial_start": lead.trial_start.isoformat() if lead.trial_start else None,
        "trial_end": lead.trial_end.isoformat() if lead.trial_end else None,
        "next_follow_up_at": lead.next_follow_up_at.isoformat() if lead.next_follow_up_at else None,
        "last_contact_at": lead.last_contact_at.isoformat() if lead.last_contact_at else None,
        "lost_reason": lead.lost_reason,
        "notes": lead.notes,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }


def _conversion_steps_from_stage_rows(stage_rows: list[tuple[str, int]]):
    stage_map = {s: c for s, c in stage_rows}
    steps = []
    for idx in range(len(CONVERSION_CHAIN) - 1):
        frm = CONVERSION_CHAIN[idx]
        to = CONVERSION_CHAIN[idx + 1]
        frm_count = int(stage_map.get(frm, 0) or 0)
        to_count = int(stage_map.get(to, 0) or 0)
        pct = round((to_count / frm_count) * 100, 2) if frm_count else 0.0
        steps.append({
            "from": frm,
            "to": to,
            "from_count": frm_count,
            "to_count": to_count,
            "conversion_pct": pct,
        })
    return steps


class LeadCreateBody(BaseModel):
    clinic_id: int | None = None
    lead_name: str
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    source: str | None = None
    stage: str | None = "new_lead"
    owner: str | None = None
    priority: str | None = "medium"
    expected_mrr: float | None = 0.0
    trial_start: str | None = None
    trial_end: str | None = None
    next_follow_up_at: str | None = None
    last_contact_at: str | None = None
    lost_reason: str | None = None
    notes: str | None = None


class LeadUpdateBody(BaseModel):
    clinic_id: int | None = None
    lead_name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: str | None = None
    source: str | None = None
    stage: str | None = None
    owner: str | None = None
    priority: str | None = None
    expected_mrr: float | None = None
    trial_start: str | None = None
    trial_end: str | None = None
    next_follow_up_at: str | None = None
    last_contact_at: str | None = None
    lost_reason: str | None = None
    notes: str | None = None


class MoveStageBody(BaseModel):
    to_stage: str
    outcome: str | None = None
    note: str | None = None


class LeadActivityBody(BaseModel):
    activity_type: str
    title: str
    details: str | None = None
    outcome: str | None = None


@router.get("/stages")
def list_stages(_=Depends(get_current_admin)):
    return STAGES


@router.get("")
def list_leads(
    stage: str = "",
    source: str = "",
    owner: str = "",
    q: str = "",
    lead_name: str = "",
    contact_person: str = "",
    phone: str = "",
    mrr_min: float | None = None,
    clinic_id: int = 0,
    page: int = 1,
    limit: int = 25,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    _ensure_growth_tables(db)

    query = db.query(GrowthLead, Clinic.name.label("clinic_name")).outerjoin(
        Clinic, GrowthLead.clinic_id == Clinic.id
    )

    if stage:
        query = query.filter(GrowthLead.stage == stage)
    if source:
        query = query.filter(GrowthLead.source == source)
    if owner:
        query = query.filter(GrowthLead.owner.ilike(f"%{owner}%"))
    if clinic_id:
        query = query.filter(GrowthLead.clinic_id == clinic_id)
    if lead_name:
        query = query.filter(GrowthLead.lead_name.ilike(f"%{lead_name}%"))
    if contact_person:
        query = query.filter(GrowthLead.contact_person.ilike(f"%{contact_person}%"))
    if phone:
        query = query.filter(GrowthLead.phone.ilike(f"%{phone}%"))
    if mrr_min is not None:
        query = query.filter(GrowthLead.expected_mrr >= mrr_min)
    if q:
        like = f"%{q}%"
        query = query.filter(
            GrowthLead.lead_name.ilike(like)
            | GrowthLead.contact_person.ilike(like)
            | GrowthLead.phone.ilike(like)
            | GrowthLead.email.ilike(like)
        )

    total = query.count()
    rows = query.order_by(GrowthLead.updated_at.desc().nullslast(), GrowthLead.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "leads": [_lead_to_dict(lead, clinic_name) for lead, clinic_name in rows],
    }


@router.get("/pipeline")
def growth_pipeline(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    _ensure_growth_tables(db)

    rows = db.query(GrowthLead).order_by(GrowthLead.updated_at.desc().nullslast(), GrowthLead.created_at.desc()).all()
    grouped = defaultdict(list)
    for lead in rows:
        st = lead.stage if lead.stage in STAGES else "new_lead"
        grouped[st].append(_lead_to_dict(lead, lead.clinic.name if lead.clinic else None))

    return {
        "stages": [
            {
                "id": st,
                "count": len(grouped.get(st, [])),
                "items": grouped.get(st, [])[:30],
            }
            for st in STAGES
        ]
    }


@router.get("/summary")
def growth_summary(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    _ensure_growth_tables(db)

    total = db.query(func.count(GrowthLead.id)).scalar() or 0
    won = db.query(func.count(GrowthLead.id)).filter(GrowthLead.stage == "won").scalar() or 0
    lost = db.query(func.count(GrowthLead.id)).filter(GrowthLead.stage == "lost").scalar() or 0
    active_trials = db.query(func.count(GrowthLead.id)).filter(GrowthLead.stage.in_(["trial_started", "trial_active"])) .scalar() or 0
    demos = db.query(func.count(GrowthLead.id)).filter(GrowthLead.stage.in_(["demo_scheduled", "demo_done"])) .scalar() or 0

    source_rows = db.query(GrowthLead.source, func.count(GrowthLead.id)).group_by(GrowthLead.source).all()
    stage_rows = db.query(GrowthLead.stage, func.count(GrowthLead.id)).group_by(GrowthLead.stage).all()
    expected_mrr = db.query(func.coalesce(func.sum(GrowthLead.expected_mrr), 0)).filter(GrowthLead.stage != "lost").scalar() or 0

    now = datetime.datetime.utcnow()
    overdue_followups = db.query(func.count(GrowthLead.id)).filter(
        GrowthLead.next_follow_up_at.isnot(None),
        GrowthLead.next_follow_up_at < now,
        GrowthLead.stage.notin_(["won", "lost"]),
    ).scalar() or 0

    overdue_rows = db.query(GrowthLead, Clinic.name.label("clinic_name")).outerjoin(
        Clinic, GrowthLead.clinic_id == Clinic.id
    ).filter(
        GrowthLead.next_follow_up_at.isnot(None),
        GrowthLead.next_follow_up_at < now,
        GrowthLead.stage.notin_(["won", "lost"]),
    ).order_by(GrowthLead.next_follow_up_at.asc()).limit(12).all()

    conversion_steps = _conversion_steps_from_stage_rows(stage_rows)

    return {
        "totals": {
            "leads": total,
            "won": won,
            "lost": lost,
            "active_trials": active_trials,
            "demos": demos,
            "expected_mrr": round(float(expected_mrr), 2),
            "overdue_followups": overdue_followups,
            "win_rate": round((won / total) * 100, 2) if total else 0,
        },
        "by_stage": [{"stage": s or "unknown", "count": c} for s, c in stage_rows],
        "by_source": [{"source": s or "unknown", "count": c} for s, c in source_rows],
        "funnel": {
            "new_lead": next((c for s, c in stage_rows if s == "new_lead"), 0),
            "connected": next((c for s, c in stage_rows if s == "connected"), 0),
            "demo_done": next((c for s, c in stage_rows if s == "demo_done"), 0),
            "trial_active": next((c for s, c in stage_rows if s == "trial_active"), 0),
            "won": won,
        },
        "overdue_leads": [
            {
                **_lead_to_dict(lead, clinic_name),
                "delay_hours": round((now - lead.next_follow_up_at).total_seconds() / 3600, 1) if lead.next_follow_up_at else 0,
            }
            for lead, clinic_name in overdue_rows
        ],
        "conversion_steps": conversion_steps,
    }


CSV_COLUMNS = [
    "lead_name", "contact_person", "phone", "email",
    "source", "stage", "owner", "priority", "expected_mrr", "notes",
]


@router.get("/sample-csv")
def download_sample_csv(_=Depends(get_current_admin)):
    rows = [
        CSV_COLUMNS,
        ["City Dental Clinic", "Dr. Priya Sharma", "9876543210", "priya@citydental.com", "instagram", "new_lead", "Audumber", "high", "899", "Interested in demo"],
        ["SmileCare Hospital", "Dr. Rahul Mehta", "9988776655", "rahul@smilecare.in", "google", "contact_attempted", "Audumber", "medium", "899", ""],
        ["Bright Smile Dental", "", "9123456789", "", "referral", "new_lead", "", "low", "", "Follow up next week"],
    ]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="leads_import_sample.csv"'},
    )


@router.post("/import-csv")
async def import_leads_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    _ensure_growth_tables(db)

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no headers")

    reader.fieldnames = [h.strip().lower().replace(" ", "_") for h in reader.fieldnames]

    if "lead_name" not in reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV must have a 'lead_name' column")

    now = datetime.datetime.utcnow()
    imported, skipped_dup, errors = 0, 0, []

    existing_phones = set(r[0] for r in db.query(GrowthLead.phone).filter(GrowthLead.phone.isnot(None)).all())
    existing_emails = set(r[0] for r in db.query(GrowthLead.email).filter(GrowthLead.email.isnot(None)).all())

    for row_num, row in enumerate(reader, start=2):
        lead_name = (row.get("lead_name") or "").strip()
        if not lead_name:
            errors.append({"row": row_num, "reason": "lead_name is empty"})
            continue

        phone = (row.get("phone") or "").strip() or None
        email = (row.get("email") or "").strip() or None

        if phone and phone in existing_phones:
            skipped_dup += 1
            continue
        if email and email in existing_emails:
            skipped_dup += 1
            continue

        stage = (row.get("stage") or "new_lead").strip()
        if stage not in STAGES:
            stage = "new_lead"

        try:
            mrr = float((row.get("expected_mrr") or "0").strip() or 0)
        except ValueError:
            mrr = 0.0

        lead = GrowthLead(
            lead_name=lead_name,
            contact_person=(row.get("contact_person") or "").strip() or None,
            phone=phone,
            email=email,
            source=(row.get("source") or "csv_import").strip() or "csv_import",
            stage=stage,
            owner=(row.get("owner") or current_user.name).strip() or current_user.name,
            priority=(row.get("priority") or "medium").strip() or "medium",
            expected_mrr=mrr,
            notes=(row.get("notes") or "").strip() or None,
            created_at=now,
            updated_at=now,
        )
        db.add(lead)
        db.flush()

        db.add(GrowthLeadActivity(
            lead_id=lead.id,
            activity_type="lead_created",
            title="Lead imported via CSV",
            by_user=current_user.name,
            to_stage=stage,
            created_at=now,
        ))

        if phone:
            existing_phones.add(phone)
        if email:
            existing_emails.add(email)

        imported += 1

    db.commit()

    return {
        "success": True,
        "imported": imported,
        "skipped_duplicates": skipped_dup,
        "errors": errors,
    }


@router.get("/{lead_id}")
def get_lead(lead_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    _ensure_growth_tables(db)

    row = db.query(GrowthLead, Clinic.name.label("clinic_name")).outerjoin(
        Clinic, GrowthLead.clinic_id == Clinic.id
    ).filter(GrowthLead.id == lead_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead, clinic_name = row
    activities = db.query(GrowthLeadActivity).filter(
        GrowthLeadActivity.lead_id == lead_id
    ).order_by(GrowthLeadActivity.created_at.desc()).limit(100).all()

    return {
        "lead": _lead_to_dict(lead, clinic_name),
        "activity": [
            {
                "id": r.id,
                "activity_type": r.activity_type,
                "title": r.title,
                "details": r.details,
                "by_user": r.by_user,
                "from_stage": r.from_stage,
                "to_stage": r.to_stage,
                "outcome": r.outcome,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in activities
        ],
    }


@router.post("")
def create_lead(body: LeadCreateBody, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    _ensure_growth_tables(db)

    if body.stage and body.stage not in STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")

    now = datetime.datetime.utcnow()
    lead = GrowthLead(
        clinic_id=body.clinic_id,
        lead_name=body.lead_name,
        contact_person=body.contact_person,
        phone=body.phone,
        email=body.email,
        source=body.source or "unknown",
        stage=body.stage or "new_lead",
        owner=body.owner or current_user.name,
        priority=body.priority or "medium",
        expected_mrr=body.expected_mrr or 0.0,
        trial_start=_dt(body.trial_start),
        trial_end=_dt(body.trial_end),
        next_follow_up_at=_dt(body.next_follow_up_at),
        last_contact_at=_dt(body.last_contact_at),
        lost_reason=body.lost_reason,
        notes=body.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(lead)
    db.flush()

    db.add(GrowthLeadActivity(
        lead_id=lead.id,
        activity_type="lead_created",
        title="Lead created",
        details=f"Lead created in stage '{lead.stage}'",
        by_user=current_user.name,
        to_stage=lead.stage,
        created_at=now,
    ))

    db.commit()
    db.refresh(lead)
    return {"success": True, "lead": _lead_to_dict(lead, lead.clinic.name if lead.clinic else None)}


@router.patch("/{lead_id}")
def update_lead(lead_id: int, body: LeadUpdateBody, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    _ensure_growth_tables(db)

    lead = db.query(GrowthLead).filter(GrowthLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    updates = body.dict(exclude_none=True)
    for field in ["trial_start", "trial_end", "next_follow_up_at", "last_contact_at"]:
        if field in updates:
            updates[field] = _dt(updates[field])

    if "stage" in updates and updates["stage"] not in STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")

    previous_stage = lead.stage
    for field, value in updates.items():
        setattr(lead, field, value)
    lead.updated_at = datetime.datetime.utcnow()

    if "stage" in updates and updates["stage"] != previous_stage:
        db.add(GrowthLeadActivity(
            lead_id=lead.id,
            activity_type="stage_changed",
            title=f"Stage changed: {previous_stage} → {lead.stage}",
            by_user=current_user.name,
            from_stage=previous_stage,
            to_stage=lead.stage,
            created_at=datetime.datetime.utcnow(),
        ))

    db.commit()
    db.refresh(lead)
    return {"success": True, "lead": _lead_to_dict(lead, lead.clinic.name if lead.clinic else None)}


@router.post("/{lead_id}/move-stage")
def move_stage(lead_id: int, body: MoveStageBody, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    _ensure_growth_tables(db)

    lead = db.query(GrowthLead).filter(GrowthLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if body.to_stage not in STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")

    old_stage = lead.stage
    lead.stage = body.to_stage
    lead.updated_at = datetime.datetime.utcnow()
    if body.to_stage in ["won", "lost"] and body.outcome:
        lead.lost_reason = body.outcome if body.to_stage == "lost" else lead.lost_reason

    db.add(GrowthLeadActivity(
        lead_id=lead.id,
        activity_type="stage_changed",
        title=f"Stage changed: {old_stage} → {body.to_stage}",
        details=body.note,
        by_user=current_user.name,
        from_stage=old_stage,
        to_stage=body.to_stage,
        outcome=body.outcome,
        created_at=datetime.datetime.utcnow(),
    ))

    db.commit()
    db.refresh(lead)
    return {"success": True, "lead": _lead_to_dict(lead, lead.clinic.name if lead.clinic else None)}


@router.get("/{lead_id}/activity")
def lead_activity(lead_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    _ensure_growth_tables(db)

    lead = db.query(GrowthLead).filter(GrowthLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    rows = db.query(GrowthLeadActivity).filter(
        GrowthLeadActivity.lead_id == lead_id
    ).order_by(GrowthLeadActivity.created_at.desc()).limit(100).all()

    return {
        "lead_id": lead_id,
        "items": [
            {
                "id": r.id,
                "activity_type": r.activity_type,
                "title": r.title,
                "details": r.details,
                "by_user": r.by_user,
                "from_stage": r.from_stage,
                "to_stage": r.to_stage,
                "outcome": r.outcome,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.post("/{lead_id}/activity")
def add_lead_activity(lead_id: int, body: LeadActivityBody, db: Session = Depends(get_db), current_user=Depends(get_current_admin)):
    _ensure_growth_tables(db)

    lead = db.query(GrowthLead).filter(GrowthLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    now = datetime.datetime.utcnow()
    item = GrowthLeadActivity(
        lead_id=lead_id,
        activity_type=body.activity_type,
        title=body.title,
        details=body.details,
        outcome=body.outcome,
        by_user=current_user.name,
        from_stage=lead.stage,
        to_stage=lead.stage,
        created_at=now,
    )
    db.add(item)

    lead.last_contact_at = now if body.activity_type in ["call", "whatsapp", "email", "meeting", "demo"] else lead.last_contact_at
    lead.updated_at = now

    db.commit()
    db.refresh(item)

    return {
        "success": True,
        "item": {
            "id": item.id,
            "activity_type": item.activity_type,
            "title": item.title,
            "details": item.details,
            "by_user": item.by_user,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        },
    }
