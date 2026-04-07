import os
import sys
import datetime
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

load_dotenv()
load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        print("Creating medications table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS medications (
                id SERIAL PRIMARY KEY,
                clinic_id INTEGER REFERENCES clinics(id),
                name VARCHAR(255) NOT NULL,
                dosage VARCHAR(255),
                duration VARCHAR(255),
                quantity VARCHAR(255),
                notes TEXT,
                category VARCHAR(100) DEFAULT 'General',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc'),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
            );
        """))
        conn.commit()
        print("Medications table created successfully.")

        # Seed default medications
        print("Seeding default medications...")
        default_meds = [
            # Antibiotics
            ("Amoxicillin 500mq", "1-0-1", "5 days", "10", "Antibiotic - Take after meals", "Antibiotics"),
            ("Augmentin 625mg", "1-0-1", "5 days", "10", "Antibiotic - Take after meals", "Antibiotics"),
            ("Azithromycin 500mg", "1-0-0", "3 days", "3", "Antibiotic - Take 1 hour before food", "Antibiotics"),
            
            # Pain Killers
            ("Paracetamol 650mg", "1-0-1", "3 days", "6", "Pain killer / Fever - SOS", "Analgesics"),
            ("Zerodol-SP", "1-0-1", "5 days", "10", "Pain and Swelling - After food", "Analgesics"),
            ("Combiflam", "1-0-1", "3 days", "6", "Pain and inflammation", "Analgesics"),
            ("Ibuprofen 400mg", "1-0-1", "3 days", "6", "Pain relief", "Analgesics"),
            
            # Anti-inflammatory / Gastric
            ("Pantoprazole 40mg", "1-0-0", "5 days", "5", "Antacid - Early morning empty stomach", "Gastrointestinal"),
            ("Omeprazole 20mg", "1-0-0", "5 days", "5", "Antacid - Empty stomach", "Gastrointestinal"),
            
            # Mouthwashes / Topical (Dental specific since it's a clinic app)
            ("Chlorhexidine Mouthwash", "0-1-0", "7 days", "1 Bottle", "Rinse for 30 seconds twice a day", "Dental"),
            ("Candid Mouth Paint", "0-0-0", "5 days", "1 Tube", "Apply locally 3 times a day", "Dental"),
            ("Metrogyl DG Gel", "0-0-0", "5 days", "1 Tube", "Apply on gums", "Dental"),
        ]

        for name, dosage, duration, quant, notes, cat in default_meds:
            # Check if exists
            result = conn.execute(text("SELECT id FROM medications WHERE name = :name AND clinic_id IS NULL"), {"name": name})
            if not result.fetchone():
                conn.execute(text("""
                    INSERT INTO medications (name, dosage, duration, quantity, notes, category, clinic_id)
                    VALUES (:name, :dosage, :duration, :quant, :notes, :cat, NULL)
                """), {"name": name, "dosage": dosage, "duration": duration, "quant": quant, "notes": notes, "cat": cat})
        
        conn.commit()
        print("Default medications seeded successfully.")

if __name__ == "__main__":
    migrate()
