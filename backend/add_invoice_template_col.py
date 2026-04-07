import os
import sys

# Ensure backend folder is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend.database import engine

def migrate():
    print("Starting clinics table migration (Invoice Templates)...")
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE clinics ADD COLUMN invoice_template VARCHAR DEFAULT 'modern_orange';"))
            print("Successfully added invoice_template to clinics.")
        except Exception as e:
            print(f"Error adding invoice_template (may already exist): {e}")
            
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
