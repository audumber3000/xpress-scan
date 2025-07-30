import os
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, ClinicUser, UserPermission
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv('SUPABASE_URL')
engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)
session = Session()

def insert_dummy():
    # Create dummy users
    user1 = ClinicUser(email="reception1@example.com", user_type="doctor", created_by="doctor@example.com", is_active=True, created_at=datetime.datetime.utcnow())
    user2 = ClinicUser(email="reception2@example.com", user_type="doctor", created_by="doctor@example.com", is_active=True, created_at=datetime.datetime.utcnow())
    session.add_all([user1, user2])
    session.commit()
    # Add permissions for user1
    permissions = [
        UserPermission(user_id=user1.id, section="patients", can_access=True, created_at=datetime.datetime.utcnow()),
        UserPermission(user_id=user1.id, section="reports", can_access=True, created_at=datetime.datetime.utcnow()),
        UserPermission(user_id=user1.id, section="billing", can_access=True, created_at=datetime.datetime.utcnow()),
    ]
    session.add_all(permissions)
    session.commit()
    print("Dummy clinic users and permissions inserted.")

if __name__ == "__main__":
    insert_dummy()
