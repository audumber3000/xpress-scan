import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load main backend env
load_dotenv(".env")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/postgres")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def upgrade():
    with engine.connect() as conn:
        with conn.begin():
            # Add referred_by_code to clinics if it doesn't exist
            try:
                conn.execute(text("ALTER TABLE clinics ADD COLUMN referred_by_code VARCHAR;"))
                print("Added 'referred_by_code' column to clinics table.")
            except Exception as e:
                print(f"Column might exist or error: {e}")

            # Note: We rely on init_local_db or just Base.metadata.create_all for referral_codes table
            # However, for manual migration:
            try:
                from models import Base
                Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables['referral_codes']])
                print("Created 'referral_codes' table.")
            except Exception as e:
                print(f"Error creating referral_codes table: {e}")

if __name__ == "__main__":
    from sqlalchemy import text
    upgrade()
    print("Migration finished securely.")
