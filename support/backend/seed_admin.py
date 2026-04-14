import hashlib
import datetime
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, User

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def seed_admin():
    db = SessionLocal()
    try:
        # We don't necessarily want to create all tables here if they exist, 
        # but SQLAlchemy's create_all is safe.
        # Actually, let's just ensure the user exists.
        
        email = "admin@molarplus.com"
        password = "admin123"
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Creating super admin: {email}")
            user = User(
                email=email,
                first_name="Super",
                last_name="Admin",
                name="Super Admin",
                role="super_admin",
                password_hash=hash_password(password),
                is_active=True,
                created_at=datetime.datetime.utcnow()
            )
            db.add(user)
            db.commit()
            print("Successfully created super admin.")
        else:
            print(f"Super admin {email} already exists. Updating password and role...")
            user.password_hash = hash_password(password)
            user.role = "super_admin"
            user.is_active = True
            db.commit()
            print("Successfully updated super admin.")
            
    except Exception as e:
        print(f"Error seeding admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
