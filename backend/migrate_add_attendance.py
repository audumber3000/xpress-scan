import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import Base, Attendance

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_attendance_table():
    print("==================================================")
    print("Attendance Table Migration")
    print("==================================================")
    print("Creating attendance table...")
    try:
        # Create table for Attendance
        Base.metadata.create_all(bind=engine, tables=[Attendance.__table__])
        print("✅ Attendance table created successfully!")
        print("   - attendance")
        return True
    except Exception as e:
        print(f"❌ Error creating attendance table: {e}")
        return False

if __name__ == "__main__":
    if create_attendance_table():
        print("\n✅ Migration completed successfully!")
    else:
        print("\n❌ Migration failed.")







