#!/usr/bin/env python3
import os
import sys
from pathlib import Path
from sqlalchemy import text
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from database import engine

def migrate():
    print("Running manual migrations...")
    columns = [
        ("dental_chart", "JSON"),
        ("tooth_notes", "JSON"),
        ("treatment_plan", "JSON"),
        ("prescriptions", "JSON")
    ]
    
    with engine.connect() as conn:
        for col_name, col_type in columns:
            try:
                # Check if column exists (Postgres specific check)
                result = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='patients' AND column_name='{col_name}'"))
                if not result.fetchone():
                    print(f"Adding column {col_name} to patients table...")
                    conn.execute(text(f"ALTER TABLE patients ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    print(f"✅ Added {col_name}")
                else:
                    print(f"Column {col_name} already exists.")
            except Exception as e:
                print(f"❌ Failed to add {col_name}: {e}")

if __name__ == "__main__":
    migrate()
