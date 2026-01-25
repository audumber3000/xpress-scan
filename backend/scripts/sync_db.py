#!/usr/bin/env python3
import os
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from database import engine
from models import Base

def sync_db():
    print("Syncing database tables with new markers...")
    try:
        # Note: In SQLite this adds columns if they don't exist, but in Postgres it might not.
        # Since we are likely using Postgres, we might need a proper migration or just create_all.
        # create_all won't drop existing columns/tables.
        Base.metadata.create_all(bind=engine)
        print("✅ Database sync complete!")
    except Exception as e:
        print(f"❌ Database sync failed: {e}")

if __name__ == "__main__":
    sync_db()
