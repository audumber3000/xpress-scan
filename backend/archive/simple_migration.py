import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Base, Clinic, User, Patient, Report, ScanType, ReferringDoctor
from datetime import datetime

# Database URL
SQLALCHEMY_DATABASE_URL = "postgresql://postgres.awdlcycjawoawdotzxpe:Wcz5SUoCECFLJYLQ@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

def simple_migration():
    """Create new multi-tenant structure with default data"""
    
    # Create engine and session
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("🚀 Starting simple migration to multi-tenant structure...")
        
        # Step 1: Drop existing tables and create new ones
        print("📋 Dropping existing tables...")
        Base.metadata.drop_all(bind=engine)
        print("✅ Existing tables dropped")
        
        print("📋 Creating new tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ New tables created successfully")
        
        # Step 2: Create default clinic
        print("🏥 Creating default clinic...")
        default_clinic = Clinic(
            name="Default Radiology Clinic",
            address="Default Address",
            phone="+1234567890",
            email="clinic@example.com",
            specialization="radiology",
            subscription_plan="free",
            status="active",
            primary_color="#10B981"
        )
        db.add(default_clinic)
        db.commit()
        default_clinic_id = default_clinic.id
        print(f"✅ Default clinic created with ID: {default_clinic_id}")
        
        # Step 3: Create default clinic owner
        print("👨‍⚕️ Creating default clinic owner...")
        default_owner = User(
            clinic_id=default_clinic_id,
            email="doctor@example.com",
            name="Default Doctor",
            role="clinic_owner",
            permissions={
                "patients:view": True,
                "patients:edit": True,
                "patients:delete": True,
                "reports:view": True,
                "reports:edit": True,
                "reports:delete": True,
                "billing:view": True,
                "billing:edit": True,
                "users:view": True,
                "users:edit": True,
                "users:delete": True,
                "users:manage": True
            },
            is_active=True
        )
        db.add(default_owner)
        db.commit()
        print("✅ Default clinic owner created")
        
        # Step 4: Create default scan types
        print("🔬 Creating default scan types...")
        default_scan_types = [
            {"name": "X-Ray Chest", "price": 500},
            {"name": "X-Ray Spine", "price": 600},
            {"name": "Ultrasound Abdomen", "price": 1200},
            {"name": "CT Scan Head", "price": 2500},
            {"name": "MRI Brain", "price": 5000}
        ]
        
        for scan_type in default_scan_types:
            new_scan_type = ScanType(
                clinic_id=default_clinic_id,
                name=scan_type["name"],
                price=scan_type["price"],
                is_active=True
            )
            db.add(new_scan_type)
            print(f"✅ Added default scan type: {scan_type['name']}")
        
        # Step 5: Create default referring doctors
        print("👨‍⚕️ Creating default referring doctors...")
        default_doctors = [
            {"name": "Dr. Sharma", "hospital": "City Hospital"},
            {"name": "Dr. Prashant", "hospital": "Medical Center"},
            {"name": "Dr. Rahul", "hospital": "General Hospital"}
        ]
        
        for doctor in default_doctors:
            new_doctor = ReferringDoctor(
                clinic_id=default_clinic_id,
                name=doctor["name"],
                hospital=doctor["hospital"],
                is_active=True
            )
            db.add(new_doctor)
            print(f"✅ Added default referring doctor: {doctor['name']}")
        
        db.commit()
        print("✅ Migration completed successfully!")
        
        print("\n🎉 Migration Summary:")
        print(f"📋 Default Clinic ID: {default_clinic_id}")
        print(f"👨‍⚕️ Default Clinic Owner: doctor@example.com")
        print(f"🔑 Login with: doctor@example.com")
        print("\n🚀 You can now test the multi-tenant system!")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    simple_migration() 