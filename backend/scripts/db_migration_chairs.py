import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add parent directory to path to import database.py if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

# Database URL from .env
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:password@127.0.0.1:5433/postgres")

def migrate():
    engine = create_engine(DATABASE_URL)
    
    # 1. Add number_of_chairs to clinics table
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE clinics ADD COLUMN number_of_chairs INTEGER DEFAULT 1"))
            print("Successfully added 'number_of_chairs' to 'clinics' table.")
    except Exception as e:
        if "already exists" in str(e).lower():
            print("'number_of_chairs' column already exists in 'clinics' table.")
        else:
            print(f"Error adding 'number_of_chairs' to 'clinics': {e}")
    
    # 2. Add columns to appointments table
    columns_to_add = [
        ("patient_age", "INTEGER"),
        ("patient_gender", "VARCHAR"),
        ("patient_village", "VARCHAR"),
        ("patient_referred_by", "VARCHAR"),
        ("chair_number", "VARCHAR")
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE appointments ADD COLUMN {col_name} {col_type}"))
                print(f"Successfully added '{col_name}' to 'appointments' table.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print(f"'{col_name}' column already exists in 'appointments' table.")
            else:
                print(f"Error adding '{col_name}' to 'appointments': {e}")
                
    # 3. Make treatment column nullable in appointments table
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE appointments ALTER COLUMN treatment DROP NOT NULL"))
            print("Successfully made 'treatment' column nullable in 'appointments' table.")
    except Exception as e:
        print(f"Error altering 'treatment' column: {e}")
    
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
