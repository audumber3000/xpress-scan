import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models import ClinicalSetting, TreatmentType, Clinic

def seed_all_data():
    db = SessionLocal()
    try:
        clinic = db.query(Clinic).first()
        if not clinic:
            print("No clinic found. Please create a clinic first.")
            return
        
        clinic_id = clinic.id
        print(f"Seeding comprehensive data for Clinic ID: {clinic_id} ({clinic.name})")

        # Full 10-category Clinical Settings Data
        clinical_settings = [
            # 1. Chief Complaints (category='complaint')
            ('complaint', 'Severe Toothache', 'Intense throbbing pain needing immediate attention'),
            ('complaint', 'Sensitivity to Cold', 'Sharp pain upon consuming cold food/drinks'),
            ('complaint', 'Sensitivity to Hot', 'Pain/discomfort when consuming hot items, often pulpitis sign'),
            ('complaint', 'Bleeding Gums', 'Spontaneous bleeding or during brushing'),
            ('complaint', 'Swelling', 'Localized or diffuse swelling in gum or facial area'),
            ('complaint', 'Food Lodgement', 'Food constantly getting stuck between specific teeth'),
            ('complaint', 'Loose Tooth', 'Feeling of mobility in one or more teeth'),
            ('complaint', 'Cosmetic Concern', 'Unhappy with tooth color, shape, or alignment'),
            ('complaint', 'Bad Breath', 'Chronic halitosis concerns'),
            ('complaint', 'Broken Restoration', 'Chip or loss of a previous filling or crown'),
            ('complaint', 'Dull Ache', 'Constant, non-throbbing pain in a region'),
            
            # 2. Clinical Findings (category='finding')
            ('finding', 'Deep Occusal Caries', 'Extensive decay on biting surfaces'),
            ('finding', 'Proximal Caries', 'Decay on the surfaces between teeth'),
            ('finding', 'Grade I Mobility', 'Slight horizontal tooth movement'),
            ('finding', 'Grade II Mobility', 'Moderate horizontal movement >1mm'),
            ('finding', 'Periodontal Pocket (5mm)', 'Measured depth indicating bone loss'),
            ('finding', 'Gingival Recession', 'Gum line has migrated towards the root'),
            ('finding', 'Generalized Calculus', 'Significant tartar buildup across multiple quadrants'),
            ('finding', 'Periapical Radiolucency', 'Dark area at root tip on X-ray suggesting infection'),
            ('finding', 'Enamel Attrition', 'Wear of enamel due to grinding/bruxism'),
            ('finding', 'Enamel Fracture', 'Visible crack or chip in enamel surface'),
            
            # 3. Final Diagnosis (category='diagnosis')
            ('diagnosis', 'Acute Irreversible Pulpitis', 'Severe pulp inflammation requiring RCT'),
            ('diagnosis', 'Chronic Periodontitis', 'Long-term periodontal disease'),
            ('diagnosis', 'Dental Caries (Class I)', 'Pits and fissures decay'),
            ('diagnosis', 'Dental Caries (Class II)', 'Proximal decay in posterior teeth'),
            ('diagnosis', 'Periapical Periodontitis', 'Infection has spread to surrounding root area'),
            ('diagnosis', 'Impacted Wisdom Tooth (38)', 'Lower left 8th tooth unable to erupt'),
            ('diagnosis', 'Localized Gingivitis', 'Inflammation confined to specific gum areas'),
            ('diagnosis', 'Pericoronitis', 'Inflammation of gum flap over wisdom tooth'),
            ('diagnosis', 'Dentine Hypersensitivity', 'Exposed dentine causing pain'),
            
            # 4. Medical History (category='medical-condition')
            ('medical-condition', 'Hypertension (High BP)', 'Patient on medication for blood pressure'),
            ('medical-condition', 'Diabetes Mellitus (Type II)', 'Controlled by oral medication'),
            ('medical-condition', 'Diabetes Mellitus (Type I)', 'Insulin dependent'),
            ('medical-condition', 'Bronchial Asthma', 'Requires inhaler (Salbutamol)'),
            ('medical-condition', 'Hypothyroidism', 'Thyroid deficiency on medication'),
            ('medical-condition', 'Pregnancy (1st Trimester)', 'Special care with X-rays and drugs'),
            ('medical-condition', 'Pregnancy (2nd Trimester)', 'Stable period for dental procedures'),
            ('medical-condition', 'Epilepsy', 'History of seizures'),
            ('medical-condition', 'Gastritis', 'Sensitivity to NSAIDs/Painkillers'),
            ('medical-condition', 'Cardiac Murmur', 'History of heart valve issues'),
            
            # 5. Clinical Allergies (category='allergy')
            ('allergy', 'Penicillin', 'Severe reaction to Penicillin group'),
            ('allergy', 'Amoxicillin', 'Allergic to Amoxicillin specifically'),
            ('allergy', 'Latex', 'Reaction to rubber gloves/products'),
            ('allergy', 'Local Anaesthesia (LA)', 'History of reaction to Lignocaine/Adrenaline'),
            ('allergy', 'Sulfa Drugs', 'Allergy to Sulfonamides'),
            ('allergy', 'Aspirin', 'Reaction to NSAIDs/Aspirin'),
            ('allergy', 'Seafood/Iodine', 'Relevant for certain surgical preps'),
            
            # 6. Ongoing Medication (category='current-medication')
            ('current-medication', 'Metformin', 'For blood sugar management'),
            ('current-medication', 'Amlodipine', 'For blood pressure management'),
            ('current-medication', 'Thyroxine', 'For thyroid hormone replacement'),
            ('current-medication', 'Pantoprazole', 'For acidity/ulcer prevention'),
            ('current-medication', 'Salbutamol Inhaler', 'For asthma management'),
            ('current-medication', 'Aspirin 75mg', 'Daily blood thinner'),
            ('current-medication', 'Folic Acid', 'Prenatal/supplemental'),
            
            # 7. Advices (category='advice')
            ('advice', 'Warm Saline Rinses', 'Rinse 3-4 times daily with lukewarm salt water'),
            ('advice', 'Avoid Hard/Crunchy Food', 'Soft diet on the treated side for 2 days'),
            ('advice', 'Brush Twice Daily', 'Use soft-bristled brush with fluoride toothpaste'),
            ('advice', 'Use Interdental Brush', 'Clean gaps between teeth once daily'),
            ('advice', 'Do Not Spit after Surgery', 'Important to keep the clot stable (for 24h)'),
            ('advice', 'Avoid Tobacco/Smoking', 'Will significantly delay healing process'),
            ('advice', 'Daily Flossing', 'Advised to clear plaque from between teeth'),
            
            # 8. Dental History (category='dental-history')
            ('dental-history', 'Previous RCT done', 'Patient had root canal in the past'),
            ('dental-history', 'Previous Extraction', 'One or more teeth removed previously'),
            ('dental-history', 'Orthodontic Braces', 'History of wearing braces/aligners'),
            ('dental-history', 'Periodontal Cleaning', 'History of regular scaling'),
            ('dental-history', 'Fixed Dental Bridge', 'Existing 3-unit or longer bridge'),
            ('dental-history', 'Dental Implant placed', 'History of surgical implant procedure'),

            # 9. Additional Fees (category='additional-fee')
            ('additional-fee', 'Consultation Fee', 'Standard visit/diagnosis fee'),
            ('additional-fee', 'After-Hours Emergency', 'Surcharge for urgent out-of-duty visits'),
            ('additional-fee', 'X-Ray (IOPAR)', 'Single tooth digital radiograph charge'),
            ('additional-fee', 'OPG (Full Mouth X-ray)', 'Panoramic X-ray screening fee'),
            ('additional-fee', 'Disposable PPE Charge', 'Infection control surcharge'),
            ('additional-fee', 'Specialist Visit Fee', 'When an external surgeon/endo visits'),
        ]

        # 10. Treatments/Procedures (Stored in treatment_types table)
        treatments = [
            ('Scaling & Polishing (Full Mouth)', 1800.0),
            ('Composite Filling (Single Surface)', 1200.0),
            ('Composite Filling (Multi Surface)', 2200.0),
            ('Root Canal Treatment (Anterior)', 4500.0),
            ('Root Canal Treatment (Posterior)', 6500.0),
            ('Re-RCT (Anterior)', 6000.0),
            ('Simple Extraction', 800.0),
            ('Surgical Extraction (Impacted)', 4500.0),
            ('Zirconia Crown (Premium)', 12500.0),
            ('E-Max Veneer', 15000.0),
            ('Dental Implant (Titanium)', 35000.0),
            ('Complete Denture (Upper/Lower)', 22000.0),
            ('Pit & Fissure Sealant', 800.0),
            ('Fluoride Application', 1000.0),
        ]

        # SEED Clinical Settings
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
                print(f"Seeded {cat}: {name}")

        # SEED Treatments
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
                print(f"Seeded Treatment: {name} (₹{price})")

        db.commit()
        print("\n🏆 SYSTEM READY: Exhaustive clinical data successfully seeded.")

    except Exception as e:
        db.rollback()
        print(f"❌ ERROR: Seeding failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_all_data()
