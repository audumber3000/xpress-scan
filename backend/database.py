import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

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

# Connection-pool hardening.
#
# The default pool (size 5 + overflow 10 = 15) is too small: every request holds
# its connection for the whole request (auth's `get_current_user` uses
# `Depends(get_db)`), so bursts — MSG91 delivery webhooks, the vision-LLM register
# OCR, bulk import — saturate the pool and unrelated calls (e.g. patient search)
# queue `pool_timeout`s then 500 with "QueuePool limit ... reached".
#
# RDS allows 191 connections and each container is a single uvicorn process, so a
# 30-connection pool per process leaves ample headroom. All values are
# env-overridable for tuning without a redeploy of code.
#   pool_pre_ping : drop dead connections (RDS closes idle ones) before use,
#                   instead of surfacing them as 500s on the next query.
#   pool_recycle  : proactively recycle connections older than this many seconds.
_engine_kwargs = {}
if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _engine_kwargs = dict(
        pool_size=int(os.environ.get("DB_POOL_SIZE", "10")),
        max_overflow=int(os.environ.get("DB_MAX_OVERFLOW", "20")),
        pool_timeout=int(os.environ.get("DB_POOL_TIMEOUT", "30")),
        pool_recycle=int(os.environ.get("DB_POOL_RECYCLE", "1800")),
        pool_pre_ping=True,
    )

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 