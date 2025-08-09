import os
import sys
import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import Base, Payment, Patient, ScanType, User, Clinic
import random

# Database URL
SQLALCHEMY_DATABASE_URL = "postgresql://postgres.awdlcycjawoawdotzxpe:Wcz5SUoCECFLJYLQ@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

def create_payments_table():
    # Create engine and session
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    try:
        print("Creating payments table using SQLAlchemy...")
        
        # Create the payments table using SQLAlchemy
        Base.metadata.create_all(bind=engine, tables=[Payment.__table__])
        print("✓ Payments table created successfully")
        
        print("\n🎉 Payment system migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        return False
    
    return True

def add_sample_payments():
    """Add some sample payment data for testing"""
    # Create engine and session
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Get first clinic
        clinic = db.query(Clinic).first()
        if not clinic:
            print("No clinics found. Please create a clinic first.")
            return False
        
        clinic_id = clinic.id
        
        # Get some patients
        patients = db.query(Patient).filter(Patient.clinic_id == clinic_id).limit(5).all()
        if not patients:
            print("No patients found. Please create patients first.")
            return False
        
        # Get some scan types
        scan_types = db.query(ScanType).filter(ScanType.clinic_id == clinic_id).all()
        
        # Get some users
        users = db.query(User).filter(User.clinic_id == clinic_id).all()
        
        payment_methods = ['Cash', 'Card', 'PayPal', 'Net Banking', 'UPI']
        statuses = ['success', 'pending', 'failed', 'refunded']
        
        sample_payments = []
        
        for patient in patients:
            # Create 2-3 payments per patient
            for j in range(random.randint(2, 3)):
                scan_type = random.choice(scan_types) if scan_types else None
                amount = scan_type.price if scan_type else random.uniform(1000, 5000)
                
                payment = Payment(
                    clinic_id=clinic_id,
                    patient_id=patient.id,
                    scan_type_id=scan_type.id if scan_type else None,
                    amount=round(amount, 2),
                    payment_method=random.choice(payment_methods),
                    status=random.choice(statuses),
                    paid_by=patient.name,
                    received_by=random.choice(users).id if users else None,
                    notes=f"Payment for {scan_type.name if scan_type else 'consultation'}",
                    created_at=datetime.datetime.utcnow(),
                    updated_at=datetime.datetime.utcnow()
                )
                
                sample_payments.append(payment)
        
        # Insert sample payments
        print(f"Inserting {len(sample_payments)} sample payments...")
        db.add_all(sample_payments)
        db.commit()
        print(f"✓ {len(sample_payments)} sample payments created successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Error adding sample payments: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting payments migration...")
    
    # Create tables and structure
    if create_payments_table():
        # Ask if user wants sample data
        response = input("\n💡 Would you like to add sample payment data for testing? (y/n): ").lower().strip()
        if response == 'y' or response == 'yes':
            add_sample_payments()
    
    print("\n🏁 Migration script completed!")
