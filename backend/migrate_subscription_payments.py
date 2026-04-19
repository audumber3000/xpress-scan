"""
Migration: create subscription_payments table
Run once: python migrate_subscription_payments.py
"""
from database import SessionLocal, engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS subscription_payments (
                id                  SERIAL PRIMARY KEY,
                subscription_id     INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
                clinic_id           INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
                user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
                provider            VARCHAR NOT NULL,
                provider_order_id   VARCHAR,
                provider_payment_id VARCHAR,
                plan_name           VARCHAR NOT NULL,
                amount              FLOAT NOT NULL,
                currency            VARCHAR DEFAULT 'INR',
                status              VARCHAR NOT NULL,
                paid_at             TIMESTAMP,
                created_at          TIMESTAMP DEFAULT NOW()
            );
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sub_payments_subscription_id ON subscription_payments(subscription_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sub_payments_clinic_id ON subscription_payments(clinic_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sub_payments_user_id ON subscription_payments(user_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sub_payments_provider_order_id ON subscription_payments(provider_order_id);"))
        conn.commit()
        print("✅ subscription_payments table created.")

    # Backfill: create one payment record for existing active paid subscribers
    db = SessionLocal()
    try:
        from models import Subscription, SubscriptionPayment
        PLAN_PRICES = {"professional": 899, "professional_annual": 8100}
        active_subs = db.query(Subscription).filter(
            Subscription.status == "active",
            Subscription.plan_name.in_(PLAN_PRICES.keys())
        ).all()

        backfilled = 0
        for sub in active_subs:
            already_exists = db.query(SubscriptionPayment).filter(
                SubscriptionPayment.subscription_id == sub.id
            ).first()
            if already_exists:
                continue

            if not sub.clinic_id:
                continue

            payment = SubscriptionPayment(
                subscription_id=sub.id,
                clinic_id=sub.clinic_id,
                user_id=sub.user_id,
                provider=sub.provider or "cashfree",
                provider_order_id=sub.provider_order_id,
                provider_payment_id=sub.provider_subscription_id,
                plan_name=sub.plan_name,
                amount=PLAN_PRICES.get(sub.plan_name, 899),
                currency="INR",
                status="paid",
                paid_at=sub.current_start or sub.created_at,
            )
            db.add(payment)
            backfilled += 1

        db.commit()
        print(f"✅ Backfilled {backfilled} existing payment records.")
    finally:
        db.close()

if __name__ == "__main__":
    run()
