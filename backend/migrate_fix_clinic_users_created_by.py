import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
db_url = os.getenv('SUPABASE_URL')
engine = create_engine(db_url)

with engine.connect() as conn:
    print('Dropping foreign key on created_by...')
    try:
        conn.execute(text('ALTER TABLE clinic_users DROP CONSTRAINT IF EXISTS clinic_users_created_by_fkey;'))
    except Exception as e:
        print(f'Warning: {e}')
    print('Altering created_by column in clinic_users to VARCHAR...')
    conn.execute(text('ALTER TABLE clinic_users ALTER COLUMN created_by TYPE VARCHAR(255);'))
    print('Migration complete.')
