import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from models import Base
from database import engine

if __name__ == "__main__":
    print("Creating tables...")
    print(f"Database URL: {os.getenv('DATABASE_URL', 'Not set')[:50]}...")
    Base.metadata.create_all(bind=engine)
    print("✅ Done! All tables created successfully.") 