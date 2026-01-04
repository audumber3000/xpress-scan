"""
Migration script to add scheduled_messages table
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import Base, ScheduledMessage
from database import engine

if __name__ == "__main__":
    print("Creating scheduled_messages table...")
    print(f"Database URL: {os.getenv('DATABASE_URL', 'Not set')[:50]}...")
    Base.metadata.create_all(bind=engine, tables=[ScheduledMessage.__table__])
    print("✅ scheduled_messages table created successfully!")

