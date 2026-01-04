import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Check if running in desktop/offline mode or cloud mode
# Desktop mode uses local PostgreSQL, cloud mode uses Render PostgreSQL
USE_LOCAL_DB = os.environ.get("USE_LOCAL_DB", "false").lower() == "true"

if USE_LOCAL_DB:
    # Local PostgreSQL for desktop app (offline mode)
    LOCAL_DB_HOST = os.environ.get("LOCAL_DB_HOST", "localhost")
    LOCAL_DB_PORT = os.environ.get("LOCAL_DB_PORT", "5432")
    LOCAL_DB_NAME = os.environ.get("LOCAL_DB_NAME", "bdent")
    LOCAL_DB_USER = os.environ.get("LOCAL_DB_USER", "postgres")
    LOCAL_DB_PASSWORD = os.environ.get("LOCAL_DB_PASSWORD", "postgres")
    SQLALCHEMY_DATABASE_URL = f"postgresql://{LOCAL_DB_USER}:{LOCAL_DB_PASSWORD}@{LOCAL_DB_HOST}:{LOCAL_DB_PORT}/{LOCAL_DB_NAME}"
else:
    # Render PostgreSQL database (online mode)
    # DATABASE_URL should be provided by Render in format:
    # postgresql://user:password@host:port/dbname
    SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL")
    
    if not SQLALCHEMY_DATABASE_URL:
        raise ValueError(
            "DATABASE_URL environment variable is required for cloud mode. "
            "Please set it to your Render PostgreSQL connection string."
        )

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 