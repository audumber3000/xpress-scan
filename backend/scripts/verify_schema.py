import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:password@127.0.0.1:5433/postgres")

def verify_schema():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Verifying schema...")
        
        # Check clinics table
        print("\nChecking 'clinics' table:")
        result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clinics' AND column_name = 'number_of_chairs'"))
        row = result.fetchone()
        if row:
            print(f"✅ 'number_of_chairs' exists: {row[0]} ({row[1]})")
        else:
            print("❌ 'number_of_chairs' MISSING from 'clinics'")
            
        # Check appointments table
        print("\nChecking 'appointments' table:")
        columns = ['patient_age', 'patient_gender', 'patient_village', 'patient_referred_by', 'chair_number', 'treatment']
        for col in columns:
            result = conn.execute(text(f"SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = '{col}'"))
            row = result.fetchone()
            if row:
                print(f"✅ '{col}' exists: {row[0]} ({row[2]}), Nullable: {row[1]}")
            else:
                print(f"❌ '{col}' MISSING from 'appointments'")

if __name__ == "__main__":
    verify_schema()
