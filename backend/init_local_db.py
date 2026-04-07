import hashlib
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Clinic, User, user_clinics
from database import SQLALCHEMY_DATABASE_URL

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    print(f"Connecting to {SQLALCHEMY_DATABASE_URL}...")
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    # Create tables
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if clinic exists
        if not db.query(Clinic).filter(Clinic.name == "Demo Clinic").first():
            print("Seeding default clinic...")
            clinic = Clinic(
                name="Demo Clinic",
                address="123 Local St",
                phone="1234567890",
                email="contact@democlinic.com",
                status="active"
            )
            db.add(clinic)
            db.commit()
            db.refresh(clinic)
            
            # Create default user
            print("Seeding default owner user (admin@example.com / password)...")
            hashed_pwd = hash_password("password")
            user = User(
                email="admin@example.com",
                first_name="Admin",
                last_name="User",
                name="Admin User",
                role="clinic_owner",
                password_hash=hashed_pwd,
                clinic_id=clinic.id,
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Add to user_clinics association
            print("Linking user to clinic...")
            db.execute(user_clinics.insert().values(
                user_id=user.id,
                clinic_id=clinic.id,
                role="clinic_owner"
            ))
            db.commit()
            
            print("✅ Seeding complete!")
        else:
            print("Database already seeded.")
            
    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
