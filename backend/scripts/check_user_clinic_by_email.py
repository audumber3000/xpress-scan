#!/usr/bin/env python3
"""Check if a user (by email) has clinic_id and clinic data. Usage: python scripts/check_user_clinic_by_email.py [email]"""
import os
import sys
from pathlib import Path

# Load .env from backend directory
backend_dir = Path(__file__).resolve().parent.parent
env_path = backend_dir / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

# Database URL (same logic as database.py)
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

if not SQLALCHEMY_DATABASE_URL:
    print("ERROR: DATABASE_URL (or local DB env vars) not set. Run from backend dir with .env configured.")
    sys.exit(1)

def main():
    email = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
    if not email:
        print("Usage: python scripts/check_user_clinic_by_email.py <email>")
        sys.exit(1)

    from sqlalchemy import create_engine, text
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        user = conn.execute(
            text("SELECT id, email, name, first_name, last_name, role, clinic_id FROM users WHERE email = :email"),
            {"email": email}
        ).fetchone()
        if not user:
            print(f"No user found with email: {email}")
            return
        user_id, u_email, name, first, last, role, clinic_id = user
        print(f"User: {u_email}")
        print(f"  id={user_id}, name={name}, role={role}, clinic_id={clinic_id}")
        if not clinic_id:
            print("  Clinic: None (user has no clinic_id)")
            return
        clinic = conn.execute(
            text("SELECT id, name, address, phone, email, specialization, subscription_plan FROM clinics WHERE id = :id"),
            {"id": clinic_id}
        ).fetchone()
        if not clinic:
            print(f"  Clinic: NOT FOUND (clinic_id={clinic_id} but no row in clinics table)")
            return
        c_id, c_name, c_addr, c_phone, c_email, c_spec, c_plan = clinic
        print("  Clinic:")
        print(f"    id={c_id}, name={c_name}, specialization={c_spec}, plan={c_plan}")
        print(f"    address={c_addr}, phone={c_phone}, email={c_email}")

if __name__ == "__main__":
    main()
