import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def add_missing_columns_to_users():
    """Add missing columns (updated_at, synced_at, sync_status) to users table if they don't exist"""
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL or SUPABASE_URL environment variable not set")
        return
    
    engine = create_engine(database_url)
    
    with engine.connect() as connection:
        with connection.begin():
            try:
                # Add updated_at column if it doesn't exist
                check_updated_at = connection.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='users' AND column_name='updated_at'
                """))
                
                if check_updated_at.fetchone() is None:
                    print("Adding updated_at column to users table...")
                    connection.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    """))
                    
                    # Set updated_at to created_at for existing records
                    connection.execute(text("""
                        UPDATE users 
                        SET updated_at = created_at 
                        WHERE updated_at IS NULL
                    """))
                    print("✅ Successfully added updated_at column")
                else:
                    print("✅ updated_at column already exists")
                
                # Add synced_at column if it doesn't exist
                check_synced_at = connection.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='users' AND column_name='synced_at'
                """))
                
                if check_synced_at.fetchone() is None:
                    print("Adding synced_at column to users table...")
                    connection.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN synced_at TIMESTAMP
                    """))
                    print("✅ Successfully added synced_at column")
                else:
                    print("✅ synced_at column already exists")
                
                # Add sync_status column if it doesn't exist
                check_sync_status = connection.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='users' AND column_name='sync_status'
                """))
                
                if check_sync_status.fetchone() is None:
                    print("Adding sync_status column to users table...")
                    connection.execute(text("""
                        ALTER TABLE users 
                        ADD COLUMN sync_status VARCHAR(20) DEFAULT 'local'
                    """))
                    
                    # Set default value for existing records
                    connection.execute(text("""
                        UPDATE users 
                        SET sync_status = 'local' 
                        WHERE sync_status IS NULL
                    """))
                    print("✅ Successfully added sync_status column")
                else:
                    print("✅ sync_status column already exists")
                
                print("\n✅ All required columns are now present in users table!")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
                raise

if __name__ == "__main__":
    add_missing_columns_to_users()

