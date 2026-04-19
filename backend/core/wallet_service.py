"""
Central wallet service for notification billing.

All notification sends must go through `check_and_deduct` before firing.
Raises InsufficientWalletBalance (HTTP 402) when balance is too low.
"""
import datetime
import logging
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# WhatsApp splits into two categories per Meta pricing
CHANNEL_COST: dict[str, float] = {
    "whatsapp_utility":    0.115,
    "whatsapp_marketing":  0.8631,
    "email":               0.02,
    "sms":                 0.15,
}

# Event types classified as marketing on WhatsApp; everything else is utility
MARKETING_EVENTS: set[str] = {"google_review", "marketing_campaign", "promotional"}


class InsufficientWalletBalance(Exception):
    """Raised when a clinic's wallet cannot cover the notification cost."""
    def __init__(self, needed: float, available: float):
        self.needed = needed
        self.available = available
        super().__init__(
            f"Insufficient wallet balance. Need ₹{needed:.4f}, have ₹{available:.4f}."
        )


def get_cost(channel: str, event_type: str = "") -> float:
    """Return cost for one notification on the given channel."""
    if channel == "whatsapp":
        key = "whatsapp_marketing" if event_type in MARKETING_EVENTS else "whatsapp_utility"
        return CHANNEL_COST[key]
    return CHANNEL_COST.get(channel, 0.0)


def get_or_create_wallet(db: Session, clinic_id: int):
    """Fetch or create a NotificationWallet for the clinic."""
    from models import NotificationWallet
    wallet = db.query(NotificationWallet).filter(
        NotificationWallet.clinic_id == clinic_id
    ).first()
    if not wallet:
        wallet = NotificationWallet(clinic_id=clinic_id, balance=0.0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def check_and_deduct(
    db: Session,
    clinic_id: int,
    channel: str,
    event_type: str,
    description: str,
) -> float:
    """
    Verify wallet has enough balance and deduct the channel cost atomically.

    Returns the cost deducted.
    Raises InsufficientWalletBalance if balance is insufficient.
    """
    from models import WalletTransaction

    cost = get_cost(channel, event_type)
    if cost == 0.0:
        return 0.0

    wallet = get_or_create_wallet(db, clinic_id)

    if wallet.balance < cost:
        raise InsufficientWalletBalance(needed=cost, available=wallet.balance)

    wallet.balance = round(wallet.balance - cost, 4)
    db.add(WalletTransaction(
        clinic_id=clinic_id,
        amount=cost,
        transaction_type="debit",
        description=description,
        status="completed",
    ))
    db.commit()
    logger.debug(f"wallet deduct clinic={clinic_id} channel={channel} cost={cost} new_balance={wallet.balance}")
    return cost


def credit(
    db: Session,
    clinic_id: int,
    amount: float,
    description: str,
) -> None:
    """Add credits to a clinic wallet (top-up or refund)."""
    from models import NotificationWallet, WalletTransaction

    wallet = get_or_create_wallet(db, clinic_id)
    wallet.balance = round(wallet.balance + amount, 4)
    wallet.last_topup_at = datetime.datetime.utcnow()
    db.add(WalletTransaction(
        clinic_id=clinic_id,
        amount=amount,
        transaction_type="credit",
        description=description,
        status="completed",
    ))
    db.commit()
    logger.info(f"wallet credit clinic={clinic_id} amount={amount} new_balance={wallet.balance}")
