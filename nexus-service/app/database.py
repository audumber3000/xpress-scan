import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load environment variables from the local .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

# Connectivity configuration
# Defaults to the same environment as the main backend
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    # Fallback to local if not provided (for development parity)
    LOCAL_DB_HOST = os.environ.get("LOCAL_DB_HOST", "localhost")
    LOCAL_DB_PORT = os.environ.get("LOCAL_DB_PORT", "5432")
    LOCAL_DB_NAME = os.environ.get("LOCAL_DB_NAME", "bdent")
    LOCAL_DB_USER = os.environ.get("LOCAL_DB_USER", "postgres")
    LOCAL_DB_PASSWORD = os.environ.get("LOCAL_DB_PASSWORD", "postgres")
    DATABASE_URL = f"postgresql://{LOCAL_DB_USER}:{LOCAL_DB_PASSWORD}@{LOCAL_DB_HOST}:{LOCAL_DB_PORT}/{LOCAL_DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
