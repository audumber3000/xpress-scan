"""
Migration: Add is_trial and trial_ends_at columns to subscriptions table.
Run with: python migrate_trial_subscription.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from database import engine

def run():
    with engine.connect() as conn:
        for col, ddl in [
            ("is_trial",      "ALTER TABLE subscriptions ADD COLUMN is_trial BOOLEAN DEFAULT FALSE"),
            ("trial_ends_at", "ALTER TABLE subscriptions ADD COLUMN trial_ends_at TIMESTAMP"),
        ]:
            try:
                conn.execute(text(ddl))
                conn.commit()
                print(f"✅ Added column: {col}")
            except Exception as e:
                conn.rollback()
                print(f"⚠️  Skipped {col} (already exists or error): {e}")

    print("Migration complete.")

if __name__ == "__main__":
    run()
