from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import NotificationLog, NotificationWallet, WalletTransaction, Clinic
from routes.auth import get_current_admin

router = APIRouter()


@router.get("/summary")
def summary(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    total_logs = db.query(func.count(NotificationLog.id)).scalar()
    total_spend = db.query(func.coalesce(func.sum(NotificationLog.cost), 0)).scalar()
    total_wallet_balance = db.query(func.coalesce(func.sum(NotificationWallet.balance), 0)).scalar()

    by_channel = (
        db.query(NotificationLog.channel, func.count(NotificationLog.id), func.sum(NotificationLog.cost))
        .group_by(NotificationLog.channel).all()
    )
    by_status = (
        db.query(NotificationLog.status, func.count(NotificationLog.id))
        .group_by(NotificationLog.status).all()
    )
    return {
        "total_logs": total_logs,
        "total_spend": round(total_spend, 2),
        "total_wallet_balance": round(total_wallet_balance, 2),
        "by_channel": [
            {"channel": r[0], "count": r[1], "spend": round(r[2] or 0, 2)}
            for r in by_channel
        ],
        "by_status": {r[0]: r[1] for r in by_status},
    }


@router.get("/logs")
def list_logs(
    page: int = 1,
    per_page: int = 100,
    clinic_id: int = None,
    channel: str = None,
    status: str = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    q = db.query(NotificationLog, Clinic.name.label("clinic_name")).join(
        Clinic, NotificationLog.clinic_id == Clinic.id
    )
    if clinic_id:
        q = q.filter(NotificationLog.clinic_id == clinic_id)
    if channel:
        q = q.filter(NotificationLog.channel == channel)
    if status:
        q = q.filter(NotificationLog.status == status)

    total = q.count()
    rows = q.order_by(NotificationLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "logs": [
            {
                "id": log.id,
                "clinic": clinic_name,
                "clinic_id": log.clinic_id,
                "channel": log.channel,
                "recipient": log.recipient,
                "event_type": log.event_type,
                "template_name": log.template_name,
                "status": log.status,
                "cost": log.cost,
                "error_message": log.error_message,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log, clinic_name in rows
        ],
    }


@router.get("/wallets")
def list_wallets(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    rows = (
        db.query(NotificationWallet, Clinic.name.label("clinic_name"))
        .join(Clinic, NotificationWallet.clinic_id == Clinic.id)
        .order_by(NotificationWallet.balance.desc())
        .all()
    )
    return [
        {
            "id": w.id,
            "clinic_id": w.clinic_id,
            "clinic": clinic_name,
            "balance": round(w.balance or 0, 2),
            "last_topup_at": w.last_topup_at.isoformat() if w.last_topup_at else None,
        }
        for w, clinic_name in rows
    ]


@router.get("/transactions")
def list_transactions(
    page: int = 1,
    per_page: int = 100,
    clinic_id: int = None,
    transaction_type: str = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    q = db.query(WalletTransaction, Clinic.name.label("clinic_name")).join(
        Clinic, WalletTransaction.clinic_id == Clinic.id
    )
    if clinic_id:
        q = q.filter(WalletTransaction.clinic_id == clinic_id)
    if transaction_type:
        q = q.filter(WalletTransaction.transaction_type == transaction_type)

    total = q.count()
    rows = q.order_by(WalletTransaction.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "transactions": [
            {
                "id": t.id,
                "clinic": clinic_name,
                "clinic_id": t.clinic_id,
                "amount": t.amount,
                "transaction_type": t.transaction_type,
                "description": t.description,
                "order_id": t.order_id,
                "status": t.status,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t, clinic_name in rows
        ],
    }
