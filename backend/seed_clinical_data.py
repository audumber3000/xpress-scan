import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models import ClinicalSetting, TreatmentType, Clinic

def seed_data():
    db = SessionLocal()
    try:
        # 1. Ensure at least one clinic exists
        clinic = db.query(Clinic).first()
        if not clinic:
            print("No clinic found. Please create a clinic first.")
            return
        
        clinic_id = clinic.id
        print(f"Seeding data for Clinic ID: {clinic_id} ({clinic.name})")

        # 2. Define Clinical Settings
        clinical_settings = [
            # Complaints
            ('complaint', 'Severe Toothache', 'Intense throbbing pain in a specific tooth'),
            ('complaint', 'Sensitivity to Cold', 'Sharp pain when consuming cold items'),
            ('complaint', 'Bleeding Gums', 'Gums bleed during brushing or flossing'),
            ('complaint', 'Swelling', 'Swelling in gums or face area'),
            ('complaint', 'Food Lodgement', 'Food getting stuck between teeth'),
            ('complaint', 'Loose Tooth', 'Mobility in one or more teeth'),
            ('complaint', 'Aesthetic Concern', 'Unhappy with the appearance of teeth'),
            ('complaint', 'Broken Filling/Tooth', 'Chip or break in existing restoration or natural tooth'),
            
            # Medical History
            ('medical-condition', 'Hypertension', 'High blood pressure'),
            ('medical-condition', 'Diabetes (Type II)', 'Non-insulin dependent diabetes'),
            ('medical-condition', 'Diabetes (Type I)', 'Insulin dependent diabetes'),
            ('medical-condition', 'Asthma', 'Respiratory condition requiring inhaler'),
            ('medical-condition', 'Cardiac Disorder', 'History of heart related issues'),
            ('medical-condition', 'Thyroid Disorder', 'Hyper or Hypo thyroidism'),
            ('medical-condition', 'Pregnancy', 'Currently pregnant'),
            ('medical-condition', 'Epilepsy', 'History of seizures'),
            
            # Allergies
            ('allergy', 'Penicillin', 'Allergic to Penicillin group of antibiotics'),
            ('allergy', 'Amoxicillin', 'Allergic to Amoxicillin'),
            ('allergy', 'Latex', 'Allergic to rubber/latex products'),
            ('allergy', 'Lignocaine (LA)', 'Allergic to local anesthesia'),
            ('allergy', 'Sulfa Drugs', 'Allergic to sulfonamides'),
            ('allergy', 'Aspirin', 'Allergic to NSAIDs/Aspirin'),
            
            # Dental History
            ('dental-history', 'Previous RCT', 'History of root canal treatment'),
            ('dental-history', 'Previous Extraction', 'History of tooth removal'),
            ('dental-history', 'Orthodontic Treatment', 'History of braces/aligners'),
            ('dental-history', 'Dental Implants', 'Existing dental implants in mouth'),
            ('dental-history', 'Regular Scaling', 'History of professional cleaning every 6 months'),
            
            # Diagnosis
            ('diagnosis', 'Irreversible Pulpitis', 'Inflammation of pulp that cannot be reversed'),
            ('diagnosis', 'Chronic Periodontitis', 'Long-term inflammation of supporting structures'),
            ('diagnosis', 'Dental Caries (Class I)', 'Pit and fissure decay'),
            ('diagnosis', 'Dental Caries (Class II)', 'Proximal decay in posterior teeth'),
            ('diagnosis', 'Impacted Third Molar', 'Wisdom tooth unable to erupt fully'),
            ('diagnosis', 'Gingivitis', 'Inflammation of the gums'),
            
            # Advice
            ('advice', 'Warm Saline Rinses', 'Rinse with warm water and salt 3-4 times daily'),
            ('advice', 'Maintain Oral Hygiene', 'Brush twice daily and floss regularly'),
            ('advice', 'Avoid Hard/Crunchy Food', 'Stick to a soft diet for the next few days'),
            ('advice', 'Tobacco Cessation', 'Advised to quit smoking/tobacco for better healing'),
            ('advice', 'Use Interdental Brush', 'Use specialized brush for gaps between teeth'),
        ]

        for cat, name, desc in clinical_settings:
            exists = db.query(ClinicalSetting).filter(
                ClinicalSetting.category == cat,
                ClinicalSetting.name == name
            ).first()
            
            if not exists:
                new_setting = ClinicalSetting(
                    clinic_id=clinic_id,
                    category=cat,
                    name=name,
                    description=desc,
                    is_active=True
                )
                db.add(new_setting)
                print(f"Added {cat}: {name}")

        # 3. Define Treatment Types (Procedures)
        treatments = [
            ('Scaling & Polishing', 1500.0),
            ('Composite Filling (Small)', 1000.0),
            ('Composite Filling (Large)', 2500.0),
            ('Root Canal Treatment (Anterior)', 4500.0),
            ('Root Canal Treatment (Posterior)', 6500.0),
            ('Simple Extraction', 800.0),
            ('Surgical Extraction', 3500.0),
            ('Zirconia Crown', 12000.0),
            ('PFM Crown', 5500.0),
            ('Dental Implant', 35000.0),
            ('Complete Denture', 25000.0),
            ('Teeth Whitening', 8000.0),
        ]

        for name, price in treatments:
            exists = db.query(TreatmentType).filter(
                TreatmentType.clinic_id == clinic_id,
                TreatmentType.name == name
            ).first()
            
            if not exists:
                new_tx = TreatmentType(
                    clinic_id=clinic_id,
                    name=name,
                    price=price,
                    is_active=True
                )
                db.add(new_tx)
                print(f"Added Treatment: {name} (₹{price})")

        db.commit()
        print("\nSUCCESS: All clinical tables populated with meaningful values.")

    except Exception as e:
        db.rollback()
        print(f"ERROR: Seeding failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
