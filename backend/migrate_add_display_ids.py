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

from models import Base, Patient, Payment, Report, Clinic
import random

# Database URL
SQLALCHEMY_DATABASE_URL = "postgresql://postgres.awdlcycjawoawdotzxpe:Wcz5SUoCECFLJYLQ@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

def add_display_id_fields():
    """Add display_id fields to patients, payments, and reports tables"""
    # Create engine and session
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    try:
        print("Adding display_id fields to tables...")
        
        with engine.connect() as connection:
            # Add display_id column to patients table
            try:
                connection.execute(text("ALTER TABLE patients ADD COLUMN display_id VARCHAR(20) UNIQUE"))
                print("✓ Added display_id to patients table")
            except Exception as e:
                if "already exists" in str(e):
                    print("✓ display_id already exists in patients table")
                else:
                    raise e
            
            # Add display_id column to payments table
            try:
                connection.execute(text("ALTER TABLE payments ADD COLUMN display_id VARCHAR(20) UNIQUE"))
                print("✓ Added display_id to payments table")
            except Exception as e:
                if "already exists" in str(e):
                    print("✓ display_id already exists in payments table")
                else:
                    raise e
            
            # Add display_id column to reports table
            try:
                connection.execute(text("ALTER TABLE reports ADD COLUMN display_id VARCHAR(20) UNIQUE"))
                print("✓ Added display_id to reports table")
            except Exception as e:
                if "already exists" in str(e):
                    print("✓ display_id already exists in reports table")
                else:
                    raise e
            
            connection.commit()
        
        print("\n🎉 Display ID fields migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        return False
    
    return True

def generate_display_id(prefix: str, clinic_id: int, record_type: str, year: int = None) -> str:
    """
    Generate medical standard display ID
    Format: PREFIX-YYYY-00001
    
    Args:
        prefix: MRN, INV, or RAD
        clinic_id: Clinic ID for scoping
        record_type: 'patient', 'payment', or 'report'
        year: Year (defaults to current year)
    """
    if year is None:
        year = datetime.datetime.now().year
    
    # Create engine and session
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Count existing records for this clinic and year
        table_name = {
            'patient': 'patients',
            'payment': 'payments', 
            'report': 'reports'
        }[record_type]
        
        # Get count of records with display_id for this clinic and year
        query = text(f"""
            SELECT COUNT(*) FROM {table_name} 
            WHERE clinic_id = :clinic_id 
            AND display_id LIKE :pattern
        """)
        
        pattern = f"{prefix}-{year}-%"
        result = db.execute(query, {"clinic_id": clinic_id, "pattern": pattern})
        count = result.scalar()
        
        # Generate next sequential number (5 digits)
        next_number = count + 1
        number_part = f"{next_number:05d}"  # 5-digit zero-padded
        
        display_id = f"{prefix}-{year}-{number_part}"
        
        return display_id
        
    except Exception as e:
        print(f"Error generating display ID: {e}")
        return f"{prefix}-{year}-00001"  # Fallback
    finally:
        db.close()

def backfill_existing_records():
    """Backfill display_id for existing records that don't have one"""
    # Create engine and session
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("\n🔄 Backfilling display IDs for existing records...")
        
        # Backfill patients
        patients_without_display_id = db.query(Patient).filter(Patient.display_id.is_(None)).all()
        print(f"Found {len(patients_without_display_id)} patients without display_id")
        
        # Group patients by clinic and year for proper sequencing
        clinic_year_counters = {}
        
        for patient in patients_without_display_id:
            year = patient.created_at.year if patient.created_at else datetime.datetime.now().year
            clinic_year_key = f"{patient.clinic_id}_{year}"
            
            if clinic_year_key not in clinic_year_counters:
                clinic_year_counters[clinic_year_key] = 0
            
            clinic_year_counters[clinic_year_key] += 1
            number_part = f"{clinic_year_counters[clinic_year_key]:05d}"
            display_id = f"MRN-{year}-{number_part}"
            
            patient.display_id = display_id
            print(f"  ✓ Patient {patient.name} (Clinic {patient.clinic_id}) → {display_id}")
        
        # Backfill payments
        payments_without_display_id = db.query(Payment).filter(Payment.display_id.is_(None)).all()
        print(f"Found {len(payments_without_display_id)} payments without display_id")
        
        payment_clinic_year_counters = {}
        
        for payment in payments_without_display_id:
            year = payment.created_at.year if payment.created_at else datetime.datetime.now().year
            clinic_year_key = f"{payment.clinic_id}_{year}"
            
            if clinic_year_key not in payment_clinic_year_counters:
                payment_clinic_year_counters[clinic_year_key] = 0
            
            payment_clinic_year_counters[clinic_year_key] += 1
            number_part = f"{payment_clinic_year_counters[clinic_year_key]:05d}"
            display_id = f"INV-{year}-{number_part}"
            
            payment.display_id = display_id
            print(f"  ✓ Payment {payment.id} (Clinic {payment.clinic_id}) → {display_id}")
        
        # Backfill reports
        reports_without_display_id = db.query(Report).filter(Report.display_id.is_(None)).all()
        print(f"Found {len(reports_without_display_id)} reports without display_id")
        
        report_clinic_year_counters = {}
        
        for report in reports_without_display_id:
            year = report.created_at.year if report.created_at else datetime.datetime.now().year
            clinic_year_key = f"{report.clinic_id}_{year}"
            
            if clinic_year_key not in report_clinic_year_counters:
                report_clinic_year_counters[clinic_year_key] = 0
            
            report_clinic_year_counters[clinic_year_key] += 1
            number_part = f"{report_clinic_year_counters[clinic_year_key]:05d}"
            display_id = f"RAD-{year}-{number_part}"
            
            report.display_id = display_id
            print(f"  ✓ Report {report.id} (Clinic {report.clinic_id}) → {display_id}")
        
        db.commit()
        print("✅ Backfill completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error during backfill: {e}")
        return False
    finally:
        db.close()
    
    return True

if __name__ == "__main__":
    print("🚀 Starting medical ID migration...")
    
    # Step 1: Add display_id fields
    if add_display_id_fields():
        # Step 2: Ask if user wants to backfill existing records
        response = input("\n💡 Would you like to backfill display IDs for existing records? (y/n): ").lower().strip()
        if response == 'y' or response == 'yes':
            backfill_existing_records()
    
    print("\n🏁 Migration script completed!")
