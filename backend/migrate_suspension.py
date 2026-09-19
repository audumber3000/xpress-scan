"""
Migration: record WHY an account was suspended, not only that it was.

`clinics.status = 'suspended'` has existed all along and nothing read it. The
CRM can now suspend an account with a reason from core/suspension.py, and the
app shows that reason to the clinic instead of letting it carry on working.

Existing suspended clinics get no reason, which reads as the default policy
message — the honest answer, since nobody recorded one at the time.

Run with: python migrate_suspension.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text

from database import engine


def run():
    with engine.connect() as conn:
        for col, ddl in [
            ("suspension_reason", "ALTER TABLE clinics ADD COLUMN suspension_reason VARCHAR(40)"),
            ("suspension_note", "ALTER TABLE clinics ADD COLUMN suspension_note TEXT"),
            ("suspended_at", "ALTER TABLE clinics ADD COLUMN suspended_at TIMESTAMP"),
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
