import os
from sqlalchemy import create_engine, text, Column, String, JSON
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in .env. Running in OFFLINE MODE - Supabase disabled")
    print("Note: Please run this SQL manually in Supabase SQL Editor")
    print("The SQL commands are:")
    print("""
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS gst_number VARCHAR;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS timings JSON DEFAULT '{
      "monday": {"open": "08:00", "close": "20:00", "closed": false},
      "tuesday": {"open": "08:00", "close": "20:00", "closed": false},
      "wednesday": {"open": "08:00", "close": "20:00", "closed": false},
      "thursday": {"open": "08:00", "close": "20:00", "closed": false},
      "friday": {"open": "08:00", "close": "20:00", "closed": false},
      "saturday": {"open": "08:00", "close": "20:00", "closed": false},
      "sunday": {"open": "08:00", "close": "20:00", "closed": true}
    }';
    """)
    exit()

engine = create_engine(DATABASE_URL)

def run_migration():
    print("🚀 Adding clinic fields migration...")

    try:
        with engine.connect() as connection:
            # Add gst_number column
            connection.execute(text("""
                ALTER TABLE clinics
                ADD COLUMN IF NOT EXISTS gst_number VARCHAR;
            """))

            # Add timings column with default value
            connection.execute(text("""
                ALTER TABLE clinics
                ADD COLUMN IF NOT EXISTS timings JSON
                DEFAULT '{
                  "monday": {"open": "08:00", "close": "20:00", "closed": false},
                  "tuesday": {"open": "08:00", "close": "20:00", "closed": false},
                  "wednesday": {"open": "08:00", "close": "20:00", "closed": false},
                  "thursday": {"open": "08:00", "close": "20:00", "closed": false},
                  "friday": {"open": "08:00", "close": "20:00", "closed": false},
                  "saturday": {"open": "08:00", "close": "20:00", "closed": false},
                  "sunday": {"open": "08:00", "close": "20:00", "closed": true}
                }';
            """))

            connection.commit()

        print("✅ Successfully added clinic fields (gst_number, timings)")

    except Exception as e:
        print(f"❌ Error running migration: {e}")
        print("\n📋 Please run this SQL manually in Supabase SQL Editor:")
        print("================================================================================")
        print("""
        ALTER TABLE clinics ADD COLUMN IF NOT EXISTS gst_number VARCHAR;

        ALTER TABLE clinics ADD COLUMN IF NOT EXISTS timings JSON DEFAULT '{
          "monday": {"open": "08:00", "close": "20:00", "closed": false},
          "tuesday": {"open": "08:00", "close": "20:00", "closed": false},
          "wednesday": {"open": "08:00", "close": "20:00", "closed": false},
          "thursday": {"open": "08:00", "close": "20:00", "closed": false},
          "friday": {"open": "08:00", "close": "20:00", "closed": false},
          "saturday": {"open": "08:00", "close": "20:00", "closed": false},
          "sunday": {"open": "08:00", "close": "20:00", "closed": true}
        }';
        """)
        print("================================================================================")

if __name__ == "__main__":
    run_migration()












