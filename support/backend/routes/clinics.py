import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import (
    Clinic, User, Patient, Appointment, Invoice, Subscription,
    GooglePlaceLink, SupportTicket,
    NotificationLog, NotificationWallet, WalletTransaction, NotificationPreference,
    UserDevice, ActivityLog,
)
from routes.auth import get_current_admin

router = APIRouter()


@router.get("")
def list_clinics(
    q: str = "",
    status: str = "",
    plan: str = "",
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    query = db.query(Clinic)
    if q:
        query = query.filter(Clinic.name.ilike(f"%{q}%"))
    if status:
        query = query.filter(Clinic.status == status)
    if plan:
        query = query.filter(Clinic.subscription_plan == plan)

    total = query.count()
    clinics = query.order_by(Clinic.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for c in clinics:
        patient_count = db.query(func.count(Patient.id)).filter(Patient.clinic_id == c.id).scalar() or 0
        revenue = db.query(func.coalesce(func.sum(Invoice.paid_amount), 0)).filter(
            Invoice.clinic_id == c.id,
            Invoice.status.in_(["paid_verified", "paid_unverified", "partially_paid"])
        ).scalar() or 0
        result.append({
            "id": c.id,
            "clinic_code": c.clinic_code,
            "name": c.name,
            "phone": c.phone,
            "email": c.email,
            "subscription_plan": c.subscription_plan,
            "status": c.status,
            "patient_count": patient_count,
            "total_revenue": round(float(revenue), 2),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return {"clinics": result, "total": total, "page": page, "limit": limit}


@router.get("/{clinic_id}")
def get_clinic(clinic_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    users = db.query(User).filter(User.clinic_id == clinic_id).all()
    patient_count = db.query(func.count(Patient.id)).filter(Patient.clinic_id == clinic_id).scalar() or 0
    appt_count = db.query(func.count(Appointment.id)).filter(Appointment.clinic_id == clinic_id).scalar() or 0
    invoice_count = db.query(func.count(Invoice.id)).filter(Invoice.clinic_id == clinic_id).scalar() or 0
    revenue = db.query(func.coalesce(func.sum(Invoice.paid_amount), 0)).filter(
        Invoice.clinic_id == clinic_id,
        Invoice.status.in_(["paid_verified", "paid_unverified", "partially_paid"])
    ).scalar() or 0

    last_appt = db.query(Appointment).filter(Appointment.clinic_id == clinic_id).order_by(
        Appointment.created_at.desc()
    ).first()

    subscription = db.query(Subscription).filter(Subscription.clinic_id == clinic_id).first()

    gplace = db.query(GooglePlaceLink).filter(GooglePlaceLink.clinic_id == clinic_id).first()

    open_tickets = db.query(func.count(SupportTicket.id)).filter(
        SupportTicket.clinic_id == clinic_id,
        SupportTicket.status.in_(["open", "in_progress"])
    ).scalar() or 0
    last_ticket = db.query(SupportTicket).filter(SupportTicket.clinic_id == clinic_id).order_by(
        SupportTicket.created_at.desc()
    ).first()

    recent_appts = db.query(Appointment).filter(Appointment.clinic_id == clinic_id).order_by(
        Appointment.created_at.desc()
    ).limit(5).all()
    recent_invoices = db.query(Invoice).filter(Invoice.clinic_id == clinic_id).order_by(
        Invoice.created_at.desc()
    ).limit(5).all()

    user_ids = [u.id for u in users]
    devices_by_user = {}
    login_activity_by_user = {}
    device_totals = {"web": 0, "android": 0, "ios": 0, "desktop": 0, "other": 0}

    if user_ids:
        user_devices = db.query(UserDevice).filter(UserDevice.user_id.in_(user_ids)).all()

        for d in user_devices:
            uid = d.user_id
            if uid not in devices_by_user:
                devices_by_user[uid] = []

            platform = (d.device_platform or '').lower()
            dtype = (d.device_type or '').lower()
            if platform == 'android':
                bucket = 'android'
            elif platform in ('ios', 'iphone', 'ipad'):
                bucket = 'ios'
            elif dtype == 'web':
                bucket = 'web'
            elif dtype == 'desktop' or platform in ('windows', 'macos', 'linux'):
                bucket = 'desktop'
            else:
                bucket = 'other'

            device_totals[bucket] += 1

            devices_by_user[uid].append({
                "id": d.id,
                "device_name": d.device_name,
                "device_type": d.device_type,
                "device_platform": d.device_platform,
                "device_os": d.device_os,
                "is_online": d.is_online,
                "last_seen": d.last_seen.isoformat() if d.last_seen else None,
                "ip_address": d.ip_address,
            })

        raw_login_logs = db.query(ActivityLog).filter(
            ActivityLog.clinic_id == clinic_id
        ).filter(
            ActivityLog.event_type.in_(["login", "logout", "user_login", "user_logout"])
        ).order_by(ActivityLog.created_at.desc()).limit(300).all()

        email_to_user_id = {u.email.lower(): u.id for u in users if u.email}
        for log in raw_login_logs:
            desc = (log.description or '').lower()
            matched_user_id = None
            for email, uid in email_to_user_id.items():
                if email in desc:
                    matched_user_id = uid
                    break

            if matched_user_id is None:
                continue

            if matched_user_id not in login_activity_by_user:
                login_activity_by_user[matched_user_id] = []

            inferred_device = 'unknown'
            if 'android' in desc:
                inferred_device = 'android'
            elif 'ios' in desc or 'iphone' in desc or 'ipad' in desc:
                inferred_device = 'ios'
            elif 'web' in desc or 'browser' in desc:
                inferred_device = 'web'
            elif 'desktop' in desc or 'windows' in desc or 'mac' in desc or 'linux' in desc:
                inferred_device = 'desktop'

            login_activity_by_user[matched_user_id].append({
                "id": log.id,
                "event_type": log.event_type,
                "description": log.description,
                "actor_name": log.actor_name,
                "device": inferred_device,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            })

    # ── Notifications ──────────────────────────────────────
    notif_channel_rows = db.query(
        NotificationLog.channel,
        NotificationLog.status,
        func.count(NotificationLog.id).label("cnt"),
        func.coalesce(func.sum(NotificationLog.cost), 0).label("cost"),
    ).filter(NotificationLog.clinic_id == clinic_id).group_by(
        NotificationLog.channel, NotificationLog.status
    ).all()

    notif_by_channel = {}
    for row in notif_channel_rows:
        ch = row.channel or "unknown"
        if ch not in notif_by_channel:
            notif_by_channel[ch] = {"total": 0, "failed": 0, "total_cost": 0.0}
        notif_by_channel[ch]["total"] += row.cnt
        if row.status == "failed":
            notif_by_channel[ch]["failed"] += row.cnt
        notif_by_channel[ch]["total_cost"] = round(
            notif_by_channel[ch]["total_cost"] + float(row.cost or 0), 4
        )

    notif_total = sum(v["total"] for v in notif_by_channel.values())
    notif_failed = sum(v["failed"] for v in notif_by_channel.values())
    notif_cost = round(sum(v["total_cost"] for v in notif_by_channel.values()), 4)

    wallet = db.query(NotificationWallet).filter(
        NotificationWallet.clinic_id == clinic_id
    ).first()

    recent_notifs = db.query(NotificationLog).filter(
        NotificationLog.clinic_id == clinic_id
    ).order_by(NotificationLog.created_at.desc()).limit(20).all()

    notif_prefs = db.query(NotificationPreference).filter(
        NotificationPreference.clinic_id == clinic_id
    ).order_by(NotificationPreference.event_type).all()

    return {
        "clinic": {
            "id": clinic.id,
            "clinic_code": clinic.clinic_code,
            "name": clinic.name,
            "address": clinic.address,
            "phone": clinic.phone,
            "email": clinic.email,
            "gst_number": clinic.gst_number,
            "specialization": clinic.specialization,
            "subscription_plan": clinic.subscription_plan,
            "status": clinic.status,
            "logo_url": clinic.logo_url,
            "number_of_chairs": clinic.number_of_chairs,
            "cashfree_customer_id": clinic.cashfree_customer_id,
            "created_at": clinic.created_at.isoformat() if clinic.created_at else None,
            "updated_at": clinic.updated_at.isoformat() if clinic.updated_at else None,
        },
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "devices": devices_by_user.get(u.id, []),
                "login_activity": login_activity_by_user.get(u.id, [])[:50],
            }
            for u in users
        ],
        "user_activity_summary": {
            "device_totals": device_totals,
            "total_user_devices": sum(device_totals.values()),
            "total_login_events": sum(len(login_activity_by_user.get(u.id, [])) for u in users),
        },
        "stats": {
            "patient_count": patient_count,
            "appointment_count": appt_count,
            "invoice_count": invoice_count,
            "total_revenue": round(float(revenue), 2),
            "last_active": last_appt.created_at.isoformat() if last_appt and last_appt.created_at else None,
        },
        "subscription": {
            "plan_name": subscription.plan_name if subscription else clinic.subscription_plan,
            "status": subscription.status if subscription else "unknown",
            "provider": subscription.provider if subscription else None,
            "provider_subscription_id": subscription.provider_subscription_id if subscription else None,
            "current_start": subscription.current_start.isoformat() if subscription and subscription.current_start else None,
            "current_end": subscription.current_end.isoformat() if subscription and subscription.current_end else None,
        } if subscription else None,
        "google_reviews": {
            "place_name": gplace.place_name if gplace else None,
            "rating": gplace.current_rating if gplace else None,
            "review_count": gplace.total_review_count if gplace else 0,
            "last_synced_at": gplace.last_synced_at.isoformat() if gplace and gplace.last_synced_at else None,
        } if gplace else None,
        "tickets": {
            "open_count": open_tickets,
            "last_ticket_at": last_ticket.created_at.isoformat() if last_ticket and last_ticket.created_at else None,
        },
        "recent_activity": {
            "appointments": [
                {
                    "id": a.id,
                    "patient_name": a.patient_name,
                    "status": a.status,
                    "appointment_date": a.appointment_date.isoformat() if a.appointment_date else None,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in recent_appts
            ],
            "invoices": [
                {
                    "id": i.id,
                    "status": i.status,
                    "total": i.total,
                    "paid_amount": i.paid_amount,
                    "created_at": i.created_at.isoformat() if i.created_at else None,
                }
                for i in recent_invoices
            ],
        },
        "notifications": {
            "total": notif_total,
            "failed": notif_failed,
            "total_cost": round(float(notif_cost), 4),
            "by_channel": notif_by_channel,
            "wallet_balance": round(float(wallet.balance), 2) if wallet else 0.0,
            "wallet_last_topup": wallet.last_topup_at.isoformat() if wallet and wallet.last_topup_at else None,
            "recent_logs": [
                {
                    "id": n.id,
                    "channel": n.channel,
                    "event_type": n.event_type,
                    "template_name": n.template_name,
                    "status": n.status,
                    "cost": n.cost,
                    "error_message": n.error_message,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in recent_notifs
            ],
            "preferences": [
                {
                    "id": p.id,
                    "event_type": p.event_type,
                    "channels": p.channels if p.channels else ([p.channel] if p.channel else []),
                    "is_enabled": p.is_enabled,
                }
                for p in notif_prefs
            ],
        },
    }


class ClinicUpdateBody(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    number_of_chairs: Optional[int] = None
    subscription_plan: Optional[str] = None
    status: Optional[str] = None


@router.patch("/{clinic_id}")
def update_clinic(clinic_id: int, body: ClinicUpdateBody, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    for field, value in body.dict(exclude_none=True).items():
        setattr(clinic, field, value)
    clinic.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(clinic)
    return {"success": True, "clinic_id": clinic_id}


@router.post("/{clinic_id}/suspend")
def suspend_clinic(clinic_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.status = "suspended"
    clinic.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"success": True, "status": "suspended"}


@router.post("/{clinic_id}/activate")
def activate_clinic(clinic_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.status = "active"
    clinic.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"success": True, "status": "active"}
