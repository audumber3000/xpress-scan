import os
import sys

# Add the parent directory to sys.path to import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine
from models import ClinicalSetting, Base
from sqlalchemy.orm import Session

def seed_clinical_defaults():
    # Ensure tables are created (or updated if missing)
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    
    defaults = [
        # 1. Chief Complaints (category='complaint')
        ('complaint', 'Severe pain in tooth', 'Acute dental pain, usually requiring immediate attention'),
        ('complaint', 'Sensitivity to hot and cold', 'Dentin hypersensitivity or pulpitis symptoms'),
        ('complaint', 'Bleeding from gums', 'Gingivitis or periodontitis indicator'),
        ('complaint', 'Swelling in jaw', 'Potential abscess or infection'),
        ('complaint', 'Broken or chipped tooth', 'Trauma or structural failure'),
        ('complaint', 'Gap between teeth', 'Diastema or food lodgement issues'),
        ('complaint', 'Missing tooth', 'Need for replacement (Implant/Bridge)'),
        ('complaint', 'General checkup', 'Routine dental screening'),
        ('complaint', 'Bad breath', 'Halitosis concerns'),
        ('complaint', 'Loose teeth', 'Mobility issues'),
        
        # 2. Clinical Findings (category='finding')
        ('finding', 'Deep dental caries', 'Significant decay reaching dentin/pulp'),
        ('finding', 'Tenderness on percussion', 'Indicator of apical periodontitis'),
        ('finding', 'Gingival recession', 'Exposure of tooth root due to gum retreat'),
        ('finding', 'Calculus and stains', 'Hardened plaque and extrinsic discolorations'),
        ('finding', 'Impacted wisdom tooth', 'Third molar unable to erupt fully'),
        ('finding', 'Periapical radiolucency', 'Dark area on X-ray indicating infection at root tip'),
        ('finding', 'Fractured cusp', 'Partial break in tooth crown'),
        ('finding', 'Enamel attrition', 'Wear of enamel due to grinding/bruxism'),
        ('finding', 'Pulp exposure', 'Direct visibility of pulp tissue'),
        ('finding', 'Grade II Mobility', 'Significant movement of tooth in socket'),

        # 3. Diagnosis (category='diagnosis')
        ('diagnosis', 'Chronic Irreversible Pulpitis', 'Inflammation of pulp that will not heal'),
        ('diagnosis', 'Acute Apical Periodontitis', 'Painful inflammation around the root tip'),
        ('diagnosis', 'Chronic Generalized Gingivitis', 'Inflammation of the entire gum line'),
        ('diagnosis', 'Dental Caries - Dentin', 'Decay involving the dentin layer'),
        ('diagnosis', 'Periapical Abscess', 'Localized collection of pus at root tip'),
        ('diagnosis', 'Impacted Mandibular Third Molar', 'Wisdom tooth stuck in lower jaw bone'),
        ('diagnosis', 'Partial Edentulism', 'Condition of having one or more missing teeth'),
        ('diagnosis', 'Attrition with sensitivity', 'Tooth wear causing pain'),
        ('diagnosis', 'Localized Periodontitis', 'Bone loss around specific teeth'),
        ('diagnosis', 'Reversible Pulpitis', 'Mild pulp inflammation that can heal after treatment'),

        # 4. Medical Conditions (category='medical-condition')
        ('medical-condition', 'Diabetes Mellitus', 'Blood sugar management considerations'),
        ('medical-condition', 'Hypertension', 'High blood pressure, stress management needed'),
        ('medical-condition', 'Asthma', 'Respiratory considerations for anesthesia'),
        ('medical-condition', 'Drug Allergy - Penicillin', 'Crucial for antibiotic prescription'),
        ('medical-condition', 'Heart Condition', 'Need for prophylactic antibiotics or cardiac consult'),
        ('medical-condition', 'Bleeding Disorder', 'Considerations for extractions/surgery'),
        ('medical-condition', 'Thyroid Disorder', 'Hormonal and metabolic management'),
        ('medical-condition', 'Epilepsy', 'Seizure precautions during treatment'),
        ('medical-condition', 'Pregnancy', 'Avoid certain X-rays and medications'),
        ('medical-condition', 'Acidity / GERD', 'Considerations for dental erosion'),
        
        # 5. Allergies (category='allergy')
        ('allergy', 'Penicillin', 'Severe reaction to penicillin-group antibiotics'),
        ('allergy', 'Latex', 'Sensitivity to dental gloves or dams'),
        ('allergy', 'Aspirin / NSAIDs', 'Reaction to common pain relievers'),
        ('allergy', 'Local Anesthesia', 'History of reaction to lidocaine/articaine'),
        ('allergy', 'Sulfa Drugs', 'Allergy to sulfonamide antibiotics'),
        ('allergy', 'Nickel', 'Sensitivity to orthodontics or base metals'),
        ('allergy', 'Pollen / Dust', 'General environmental allergies'),
        ('allergy', 'Milk / Dairy', 'Considerations for certain dental pastes'),
        
        # 6. Dental History (category='dental-history')
        ('dental-history', 'Previous Root Canal', 'History of endodontic treatment'),
        ('dental-history', 'Tooth Extraction', 'Past history of losing permanent teeth'),
        ('dental-history', 'Orthodontic Braces', 'Previous alignment correction'),
        ('dental-history', 'Dental Implants', 'Past surgical tooth replacement'),
        ('dental-history', 'Scaling & Polishing', 'Routine professional cleaning'),
        ('dental-history', 'Crowns or Bridges', 'History of fixed prosthodontics'),
        ('dental-history', 'Gum Surgery', 'Past periodontal intervention'),
    ]

    try:
        print(f"🌱 Seeding {len(defaults)} clinical defaults...")
        added_count = 0
        for cat, name, desc in defaults:
            # Check if exists (system-wide, clinic_id is None)
            exists = db.query(ClinicalSetting).filter(
                ClinicalSetting.category == cat,
                ClinicalSetting.name == name,
                ClinicalSetting.clinic_id == None
            ).first()
            
            if not exists:
                setting = ClinicalSetting(
                    category=cat,
                    name=name,
                    description=desc,
                    clinic_id=None,
                    is_active=True
                )
                db.add(setting)
                added_count += 1
        
        db.commit()
        print(f"✅ Seeding complete! Added {added_count} new records.")
    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_clinical_defaults()
