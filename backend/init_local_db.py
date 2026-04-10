import hashlib
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Clinic, User, user_clinics
from database import SQLALCHEMY_DATABASE_URL
from domains.infrastructure.services.firebase_auth import create_firebase_user

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

DEMO_CLINIC_NAME = "Demo Clinic"
DEMO_EMAIL = "example@gmail.com"
DEMO_PASSWORD = "Password"


def ensure_demo_user(db, clinic: Clinic):
    user = db.query(User).filter(User.email == DEMO_EMAIL).first()

    firebase_user_id = None
    try:
        firebase_user = create_firebase_user(DEMO_EMAIL, DEMO_PASSWORD, "Demo Reviewer")
        if firebase_user:
            firebase_user_id = firebase_user["uid"]
            print(f"Firebase demo user ready for {DEMO_EMAIL}")
        else:
            print(f"Firebase demo user may already exist or Firebase is unavailable for {DEMO_EMAIL}")
    except Exception as e:
        print(f"Warning: could not create Firebase demo user: {e}")

    hashed_pwd = hash_password(DEMO_PASSWORD)

    if not user:
        print(f"Seeding default owner user ({DEMO_EMAIL} / {DEMO_PASSWORD})...")
        user = User(
            email=DEMO_EMAIL,
            first_name="Demo",
            last_name="Reviewer",
            name="Demo Reviewer",
            role="clinic_owner",
            password_hash=hashed_pwd,
            clinic_id=clinic.id,
            is_active=True,
            supabase_user_id=firebase_user_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        print(f"Demo user already exists for {DEMO_EMAIL}, syncing fields...")
        user.first_name = user.first_name or "Demo"
        user.last_name = user.last_name or "Reviewer"
        user.name = user.name or "Demo Reviewer"
        user.role = user.role or "clinic_owner"
        user.password_hash = hashed_pwd
        user.clinic_id = user.clinic_id or clinic.id
        user.is_active = True
        if firebase_user_id and (not user.supabase_user_id or user.supabase_user_id.startswith("local_")):
            user.supabase_user_id = firebase_user_id
        db.commit()
        db.refresh(user)

    existing_link = db.execute(
        user_clinics.select().where(
            (user_clinics.c.user_id == user.id) &
            (user_clinics.c.clinic_id == clinic.id)
        )
    ).first()

    if not existing_link:
        print("Linking demo user to clinic...")
        db.execute(user_clinics.insert().values(
            user_id=user.id,
            clinic_id=clinic.id,
            role="clinic_owner"
        ))
        db.commit()

    return user

def init_db():
    print(f"Connecting to {SQLALCHEMY_DATABASE_URL}...")
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    # Create tables
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        clinic = db.query(Clinic).filter(Clinic.name == DEMO_CLINIC_NAME).first()

        if not clinic:
            print("Seeding default clinic...")
            clinic = Clinic(
                name=DEMO_CLINIC_NAME,
                address="123 Local St",
                phone="1234567890",
                email="contact@democlinic.com",
                status="active"
            )
            db.add(clinic)
            db.commit()
            db.refresh(clinic)
        else:
            print("Demo clinic already exists.")

        ensure_demo_user(db, clinic)
        print("✅ Demo seeding complete!")
            
    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
