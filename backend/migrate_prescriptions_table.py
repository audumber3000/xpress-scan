"""
Migration: Create prescriptions table for multi-visit prescription support.
Run once: python backend/migrate_prescriptions_table.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        # Check if table already exists
        result = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_name = 'prescriptions'"
        ))
        exists = result.scalar() > 0

        if exists:
            print("✅ Table 'prescriptions' already exists — skipping.")
            return

        conn.execute(text("""
            CREATE TABLE prescriptions (
                id             SERIAL PRIMARY KEY,
                clinic_id      INT NOT NULL,
                patient_id     INT NOT NULL,
                appointment_id INT,
                visit_number   INT,
                items          JSON NOT NULL DEFAULT '[]',
                notes          TEXT,
                pdf_url        VARCHAR(1024),
                created_at     TIMESTAMP DEFAULT NOW(),
                updated_at     TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY (clinic_id)      REFERENCES clinics(id)      ON DELETE CASCADE,
                FOREIGN KEY (patient_id)     REFERENCES patients(id)     ON DELETE CASCADE,
                FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
            )
        """))
        conn.commit()
        print("✅ Table 'prescriptions' created successfully.")

if __name__ == "__main__":
    run()
