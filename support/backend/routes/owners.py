import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from pydantic import BaseModel
from database import get_db
from models import Clinic, User, Patient, Appointment, Invoice, Subscription
from routes.auth import get_current_admin
from routes.clinics import DELETE_PASSWORD, _delete_firebase_user
from services.cascade import cascade_delete_clinics, discover_owner_scope

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
def list_owners(
    q: str = "",
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    """List clinic owners with aggregate stats across all their clinics."""
    rows = db.execute(text("""
        WITH owners AS (
            SELECT DISTINCT u.id FROM users u
            JOIN user_clinics uc ON uc.user_id = u.id
            WHERE uc.role = 'clinic_owner' AND uc.is_active = true
              AND (:q = '' OR u.email ILIKE :like OR u.name ILIKE :like)
        )
        SELECT
            u.id, u.email, u.name, u.created_at,
            (SELECT COUNT(*) FROM user_clinics uc
              WHERE uc.user_id = u.id AND uc.role = 'clinic_owner' AND uc.is_active = true
            ) AS clinic_count
        FROM users u
        WHERE u.id IN (SELECT id FROM owners)
        ORDER BY u.created_at DESC
        OFFSET :offset LIMIT :limit
    """), {
        "q": q, "like": f"%{q}%",
        "offset": (page - 1) * limit, "limit": limit,
    }).fetchall()

    total = db.execute(text("""
        SELECT COUNT(DISTINCT u.id) FROM users u
        JOIN user_clinics uc ON uc.user_id = u.id
        WHERE uc.role = 'clinic_owner' AND uc.is_active = true
          AND (:q = '' OR u.email ILIKE :like OR u.name ILIKE :like)
    """), {"q": q, "like": f"%{q}%"}).scalar() or 0

    owners = []
    for r in rows:
        owner_id = r[0]
        clinics = db.execute(text("""
            SELECT c.id, c.name, c.clinic_code, c.clinic_label, c.subscription_plan, c.status
            FROM clinics c
            JOIN user_clinics uc ON uc.clinic_id = c.id
            WHERE uc.user_id = :o AND uc.role = 'clinic_owner' AND uc.is_active = true
            ORDER BY c.id ASC
        """), {"o": owner_id}).fetchall()

        clinic_ids = [c[0] for c in clinics]
        if clinic_ids:
            patient_count = db.query(func.count(Patient.id)).filter(Patient.clinic_id.in_(clinic_ids)).scalar() or 0
            revenue = db.query(func.coalesce(func.sum(Invoice.paid_amount), 0)).filter(
                Invoice.clinic_id.in_(clinic_ids),
                Invoice.status.in_(["paid_verified", "paid_unverified", "partially_paid"]),
            ).scalar() or 0
        else:
            patient_count = 0
            revenue = 0

        owners.append({
            "id": owner_id,
            "email": r[1],
            "name": r[2],
            "created_at": r[3].isoformat() if r[3] else None,
            "clinic_count": r[4],
            "patient_count": patient_count,
            "total_revenue": round(float(revenue), 2),
            "clinics": [
                {
                    "id": c[0], "name": c[1], "clinic_code": c[2],
                    "clinic_label": c[3], "subscription_plan": c[4], "status": c[5],
                }
                for c in clinics
            ],
        })

    return {"owners": owners, "total": total, "page": page, "limit": limit}


@router.get("/{owner_id}")
def get_owner(owner_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    owner = db.query(User).filter(User.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    clinic_ids, user_ids, user_info = discover_owner_scope(db, owner_id)

    clinics = db.query(Clinic).filter(Clinic.id.in_(clinic_ids)).all() if clinic_ids else []

    patient_count = db.query(func.count(Patient.id)).filter(Patient.clinic_id.in_(clinic_ids)).scalar() or 0 if clinic_ids else 0
    appointment_count = db.query(func.count(Appointment.id)).filter(Appointment.clinic_id.in_(clinic_ids)).scalar() or 0 if clinic_ids else 0
    invoice_count = db.query(func.count(Invoice.id)).filter(Invoice.clinic_id.in_(clinic_ids)).scalar() or 0 if clinic_ids else 0
    revenue = (db.query(func.coalesce(func.sum(Invoice.paid_amount), 0)).filter(
        Invoice.clinic_id.in_(clinic_ids),
        Invoice.status.in_(["paid_verified", "paid_unverified", "partially_paid"]),
    ).scalar() or 0) if clinic_ids else 0

    subs = db.query(Subscription).filter(Subscription.user_id == owner_id).all()

    return {
        "owner": {
            "id": owner.id,
            "email": owner.email,
            "name": owner.name,
            "role": owner.role,
            "is_active": owner.is_active,
            "created_at": owner.created_at.isoformat() if owner.created_at else None,
        },
        "clinics": [
            {
                "id": c.id, "name": c.name, "clinic_code": c.clinic_code,
                "clinic_label": c.clinic_label, "parent_clinic_id": c.parent_clinic_id,
                "subscription_plan": c.subscription_plan, "status": c.status,
                "phone": c.phone, "email": c.email, "address": c.address,
            }
            for c in clinics
        ],
        "impact": {
            "clinic_count": len(clinics),
            "patient_count": patient_count,
            "appointment_count": appointment_count,
            "invoice_count": invoice_count,
            "total_revenue": round(float(revenue), 2),
            "users_to_delete": user_info,
        },
        "subscriptions": [
            {
                "plan_name": s.plan_name, "status": s.status,
                "provider": s.provider, "is_trial": bool(getattr(s, "is_trial", False)),
                "current_end": s.current_end.isoformat() if s.current_end else None,
            }
            for s in subs
        ],
    }


class DeleteOwnerBody(BaseModel):
    password: str


@router.delete("/{owner_id}")
def delete_owner(
    owner_id: int,
    body: DeleteOwnerBody,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    if body.password != DELETE_PASSWORD:
        raise HTTPException(status_code=403, detail="Incorrect password")

    owner = db.query(User).filter(User.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    owner_email = owner.email

    clinic_ids, user_ids, user_info = discover_owner_scope(db, owner_id)
    if not clinic_ids:
        raise HTTPException(
            status_code=400,
            detail="This user does not own any clinics. Nothing to delete.",
        )

    firebase_uids = [info["firebase_uid"] for info in user_info if info.get("firebase_uid")]

    try:
        cascade_delete_clinics(db, clinic_ids, user_ids)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Delete owner {owner_id} failed: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

    fb_deleted = 0
    for uid in firebase_uids:
        if _delete_firebase_user(uid):
            fb_deleted += 1

    return {
        "deleted": True,
        "owner_id": owner_id,
        "owner_email": owner_email,
        "clinics_deleted": len(clinic_ids),
        "users_deleted": len(user_ids),
        "firebase_users_deleted": fb_deleted,
        "firebase_users_total": len(firebase_uids),
    }
