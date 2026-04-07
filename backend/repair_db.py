import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

USE_LOCAL_DB = os.environ.get("USE_LOCAL_DB", "false").lower() == "true"

if USE_LOCAL_DB:
    LOCAL_DB_HOST = os.environ.get("LOCAL_DB_HOST", "localhost")
    LOCAL_DB_PORT = os.environ.get("LOCAL_DB_PORT", "5432")
    LOCAL_DB_NAME = os.environ.get("LOCAL_DB_NAME", "bdent")
    LOCAL_DB_USER = os.environ.get("LOCAL_DB_USER", "postgres")
    LOCAL_DB_PASSWORD = os.environ.get("LOCAL_DB_PASSWORD", "postgres")
    SQLALCHEMY_DATABASE_URL = f"postgresql://{LOCAL_DB_USER}:{LOCAL_DB_PASSWORD}@{LOCAL_DB_HOST}:{LOCAL_DB_PORT}/{LOCAL_DB_NAME}"
else:
    SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL")

engine = create_engine(SQLALCHEMY_DATABASE_URL)

def repair_schema():
    print(f"Connecting to database to repair schema...")
    with engine.connect() as conn:
        # 1. Add allergies column to case_papers if missing
        try:
            print("Checking/Adding 'allergies' column to 'case_papers'...")
            # Check if column exists (Postgres specific)
            res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='case_papers' AND column_name='allergies';")).fetchone()
            if not res:
                print("Adding 'allergies' column...")
                conn.execute(text("ALTER TABLE case_papers ADD COLUMN allergies TEXT;"))
                conn.commit()
                print("✅ Successfully added 'allergies' column.")
            else:
                print("✅ 'allergies' column already exists.")
        except Exception as e:
            print(f"Error adding allergies column: {e}")

        # 2. Ensure LabOrder table is captured (create_all will handle this if not already done)
        print("Ensuring all missing tables are created...")
        try:
            from models import Base
            Base.metadata.create_all(bind=engine)
            print("✅ All tables verified/created.")
        except Exception as e:
            print(f"Error creating tables: {e}")

if __name__ == "__main__":
    repair_schema()
