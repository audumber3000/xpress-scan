import os
import sys
from dotenv import load_dotenv

# Add backend to path for imports
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))

from sqlalchemy import create_engine
from models import Base, TemplateConfiguration, Clinic, User # Now backend is on path

# Load environment variables
load_dotenv('backend/.env')

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in .env")
    sys.exit(1)

def migrate():
    engine = create_engine(DATABASE_URL)
    # This will only create tables that don't exist yet
    Base.metadata.create_all(bind=engine, tables=[TemplateConfiguration.__table__])
    print("✅ table 'template_configurations' created successfully")

if __name__ == "__main__":
    migrate()
