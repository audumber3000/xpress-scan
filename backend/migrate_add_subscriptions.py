import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import Base, Subscription
from database import engine

if __name__ == "__main__":
    print("Creating subscriptions table...")
    print(f"Database URL: {os.getenv('DATABASE_URL', 'Not set')[:50]}...")
    Base.metadata.create_all(bind=engine, tables=[Subscription.__table__])
    print("✅ Subscriptions table created successfully!")







