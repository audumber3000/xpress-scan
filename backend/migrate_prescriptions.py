import os
import sys

# Ensure backend folder is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from database import engine

def migrate():
    print("Starting patients table migration (Prescriptions)...")
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE patients ADD COLUMN prescriptions JSONB DEFAULT '[]'::jsonb;"))
            print("Successfully added prescriptions to patients.")
        except Exception as e:
            print(f"Error adding prescriptions (may already exist): {e}")
            
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
