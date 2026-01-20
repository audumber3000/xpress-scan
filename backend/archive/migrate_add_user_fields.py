import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL
SQLALCHEMY_DATABASE_URL = "postgresql://postgres.awdlcycjawoawdotzxpe:Wcz5SUoCECFLJYLQ@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

def migrate_user_table():
    """Add new fields to users table"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    with engine.connect() as conn:
        try:
            # Add first_name column if it doesn't exist
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS first_name VARCHAR;
            """))
            
            # Add last_name column if it doesn't exist
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS last_name VARCHAR;
            """))
            
            # Add supabase_user_id column if it doesn't exist
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS supabase_user_id VARCHAR;
            """))
            
            # Make clinic_id nullable if it's not already
            conn.execute(text("""
                ALTER TABLE users 
                ALTER COLUMN clinic_id DROP NOT NULL;
            """))
            
            # Update existing users to have first_name and last_name from name field
            conn.execute(text("""
                UPDATE users 
                SET first_name = name, last_name = ''
                WHERE first_name IS NULL;
            """))
            
            conn.commit()
            print("Migration completed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            conn.rollback()

if __name__ == "__main__":
    migrate_user_table() 