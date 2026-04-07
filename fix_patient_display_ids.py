import os
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Patient, Clinic
from dotenv import load_dotenv

# Load environment variables from backend/.env
load_dotenv('backend/.env')

def fix_display_ids():
    db = SessionLocal()
    try:
        # Get all clinics
        clinics = db.query(Clinic).all()
        print(f"Found {len(clinics)} clinics to check.")
        
        total_fixed = 0
        
        for clinic in clinics:
            # Get patients for this clinic ordered by ID
            patients = db.query(Patient).filter(
                Patient.clinic_id == clinic.id
            ).order_by(Patient.id).all()
            
            print(f"Clinic: {clinic.name} (ID: {clinic.id}) - {len(patients)} patients")
            
            # We want to maintain some consistency. We'll assign IDs starting from 100001
            # But we must respect existing display_ids if they exist
            
            # Step 1: Find used display_ids to avoid collisions
            used_ids = {p.display_id for p in patients if p.display_id}
            
            current_count = 1
            for patient in patients:
                print(f"  Patient: {patient.name} (ID: {patient.id}) - Current Display ID: '{patient.display_id}'")
                if not patient.display_id or patient.display_id.strip() == "":
                    # Generate a new one
                    while True:
                        new_id = str(100000 + current_count)
                        if new_id not in used_ids:
                            patient.display_id = new_id
                            used_ids.add(new_id)
                            total_fixed += 1
                            print(f"    -> Assigned New Display ID: {new_id}")
                            break
                        current_count += 1
                    current_count += 1
            
        db.commit()
        print(f"Successfully fixed {total_fixed} patient display IDs.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_display_ids()
