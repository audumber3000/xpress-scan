import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set in support/.env")

# pool_pre_ping verifies a pooled connection is alive before handing it out, and
# pool_recycle drops connections older than 5 min. Both are essential here: the
# DB is reached over an SSH tunnel whose idle channels can be closed, which
# otherwise surfaces as "server closed the connection unexpectedly".
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
