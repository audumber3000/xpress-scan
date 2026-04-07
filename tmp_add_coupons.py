import os
import sys
from datetime import datetime, timedelta

# Add current directory to path so it can find 'backend'
sys.path.append(os.getcwd())
# Also add backend directory specifically for its internal imports
sys.path.append(os.path.join(os.getcwd(), "backend"))

from backend.database import SessionLocal, engine
from backend.models import SubscriptionCoupon, Base

def add_test_coupon():
    # Create table if it doesn't exist
    print("Creating tables if they don't exist...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if coupon already exists
        existing = db.query(SubscriptionCoupon).filter(SubscriptionCoupon.code == "MOLARPRO40").first()
        if existing:
            print("Coupon MOLARPRO40 already exists")
        else:
            coupon = SubscriptionCoupon(
                code="MOLARPRO40",
                discount_amount=480.0, # 40% of 1200
                is_active=True,
                expiry_date=datetime.utcnow() + timedelta(days=30),
                usage_limit=1000,
                used_count=0
            )
            db.add(coupon)
            db.commit()
            print("✅ Added test coupon: MOLARPRO40 (₹480 off)")
        
        # Another one for percent
        existing2 = db.query(SubscriptionCoupon).filter(SubscriptionCoupon.code == "SAVE50").first()
        if not existing2:
            coupon2 = SubscriptionCoupon(
                code="SAVE50",
                discount_percent=50.0,
                is_active=True,
                expiry_date=datetime.utcnow() + timedelta(days=30),
                usage_limit=1000,
                used_count=0
            )
            db.add(coupon2)
            db.commit()
            print("✅ Added test coupon: SAVE50 (50% off)")
            
    finally:
        db.close()

if __name__ == "__main__":
    add_test_coupon()
