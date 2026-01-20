import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Base, Clinic, User, Patient, Report, ScanType, ReferringDoctor
from datetime import datetime

# Database URL
SQLALCHEMY_DATABASE_URL = "postgresql://postgres.awdlcycjawoawdotzxpe:Wcz5SUoCECFLJYLQ@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

def migrate_to_multi_tenant():
    """Migrate existing single-tenant data to multi-tenant structure"""
    
    # Create engine and session
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("🚀 Starting migration to multi-tenant structure...")
        
        # Step 1: Create new tables
        print("📋 Creating new tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully")
        
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
        
        # Step 4: Migrate existing data using raw SQL
        print("📊 Migrating existing data...")
        
        # Migrate patients using raw SQL
        try:
            result = db.execute(text("SELECT * FROM patients LIMIT 1"))
            if result.fetchone():
                print("🩺 Migrating patients...")
                patients_result = db.execute(text("SELECT * FROM patients"))
                for patient_row in patients_result:
                    insert_sql = text("""
                        INSERT INTO patients (clinic_id, name, age, gender, village, phone, referred_by, scan_type, notes, payment_type, created_at)
                        VALUES (:clinic_id, :name, :age, :gender, :village, :phone, :referred_by, :scan_type, :notes, :payment_type, :created_at)
                    """)
                    db.execute(insert_sql, {
                        'clinic_id': default_clinic_id,
                        'name': patient_row.name,
                        'age': patient_row.age,
                        'gender': patient_row.gender,
                        'village': patient_row.village,
                        'phone': patient_row.phone,
                        'referred_by': patient_row.referred_by,
                        'scan_type': patient_row.scan_type,
                        'notes': patient_row.notes,
                        'payment_type': patient_row.payment_type,
                        'created_at': patient_row.created_at
                    })
                    print(f"✅ Added patient: {patient_row.name}")
        except Exception as e:
            print(f"⚠️ No existing patients table or error: {e}")
        
        # Migrate scan types using raw SQL
        try:
            result = db.execute(text("SELECT * FROM scan_types LIMIT 1"))
            if result.fetchone():
                print("🔬 Migrating scan types...")
                scan_types_result = db.execute(text("SELECT * FROM scan_types"))
                for scan_row in scan_types_result:
                    insert_sql = text("""
                        INSERT INTO scan_types (clinic_id, name, price, is_active)
                        VALUES (:clinic_id, :name, :price, :is_active)
                    """)
                    db.execute(insert_sql, {
                        'clinic_id': default_clinic_id,
                        'name': scan_row.name,
                        'price': scan_row.price,
                        'is_active': True
                    })
                    print(f"✅ Added scan type: {scan_row.name}")
        except Exception as e:
            print(f"⚠️ No existing scan_types table or error: {e}")
        
        # Migrate referring doctors using raw SQL
        try:
            result = db.execute(text("SELECT * FROM referring_doctors LIMIT 1"))
            if result.fetchone():
                print("👨‍⚕️ Migrating referring doctors...")
                doctors_result = db.execute(text("SELECT * FROM referring_doctors"))
                for doctor_row in doctors_result:
                    insert_sql = text("""
                        INSERT INTO referring_doctors (clinic_id, name, hospital, is_active)
                        VALUES (:clinic_id, :name, :hospital, :is_active)
                    """)
                    db.execute(insert_sql, {
                        'clinic_id': default_clinic_id,
                        'name': doctor_row.name,
                        'hospital': doctor_row.hospital,
                        'is_active': True
                    })
                    print(f"✅ Added referring doctor: {doctor_row.name}")
        except Exception as e:
            print(f"⚠️ No existing referring_doctors table or error: {e}")
        
        # Migrate reports using raw SQL
        try:
            result = db.execute(text("SELECT * FROM reports LIMIT 1"))
            if result.fetchone():
                print("📄 Migrating reports...")
                reports_result = db.execute(text("SELECT * FROM reports"))
                for report_row in reports_result:
                    insert_sql = text("""
                        INSERT INTO reports (clinic_id, patient_id, docx_url, pdf_url, status, created_at)
                        VALUES (:clinic_id, :patient_id, :docx_url, :pdf_url, :status, :created_at)
                    """)
                    db.execute(insert_sql, {
                        'clinic_id': default_clinic_id,
                        'patient_id': report_row.patient_id,
                        'docx_url': report_row.docx_url,
                        'pdf_url': report_row.pdf_url,
                        'status': report_row.status,
                        'created_at': report_row.created_at
                    })
                    print(f"✅ Added report for patient ID: {report_row.patient_id}")
        except Exception as e:
            print(f"⚠️ No existing reports table or error: {e}")
        
        db.commit()
        print("✅ Migration completed successfully!")
        
        # Step 5: Create default scan types if none exist
        print("🔬 Creating default scan types...")
        existing_scan_types = db.query(ScanType).filter(ScanType.clinic_id == default_clinic_id).count()
        if existing_scan_types == 0:
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
            
            db.commit()
            print("✅ Default scan types created")
        
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
    migrate_to_multi_tenant() 