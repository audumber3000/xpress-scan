import os
import sys
from sqlalchemy import text

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine

def reset_clinical_tables():
    with engine.connect() as conn:
        print("🗑️  Dropping clinical tables...")
        conn.execute(text("DROP TABLE IF EXISTS clinical_settings CASCADE"))
        # Also drop case_papers just to be sure it's created with new schema
        conn.execute(text("DROP TABLE IF EXISTS case_papers CASCADE"))
        conn.commit()
    print("✅ Tables dropped!")

if __name__ == "__main__":
    reset_clinical_tables()
