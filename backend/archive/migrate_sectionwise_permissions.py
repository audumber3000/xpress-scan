import sqlalchemy
from sqlalchemy import create_engine, MetaData, Table, Column, Boolean
from sqlalchemy.engine.reflection import Inspector
import os

# Load DB URL from env
SUPABASE_URL = os.getenv("SUPABASE_URL")
if not SUPABASE_URL:
    raise Exception("SUPABASE_URL not set in environment!")

engine = create_engine(SUPABASE_URL)
metadata = MetaData()
metadata.reflect(bind=engine)

with engine.connect() as conn:
    insp = Inspector.from_engine(engine)
    # Drop old columns if they exist
    columns = [col['name'] for col in insp.get_columns('user_permissions')]
    for old_col in ['can_view', 'can_edit', 'can_delete']:
        if old_col in columns:
            print(f"Dropping column {old_col}...")
            conn.execute(sqlalchemy.text(f'ALTER TABLE user_permissions DROP COLUMN {old_col}'))
    # Add can_access if not exists
    if 'can_access' not in columns:
        print("Adding column can_access...")
        conn.execute(sqlalchemy.text('ALTER TABLE user_permissions ADD COLUMN can_access BOOLEAN DEFAULT TRUE'))
    print("Migration complete. user_permissions now uses section-wise permissions (can_access only).")
