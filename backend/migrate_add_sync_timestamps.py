import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

def add_sync_timestamps():
    """Add sync timestamp fields to all tables"""
    
    # Get database URL from environment variables
    USE_LOCAL_DB = os.environ.get("USE_LOCAL_DB", "false").lower() == "true"
    
    if USE_LOCAL_DB:
        LOCAL_DB_HOST = os.environ.get("LOCAL_DB_HOST", "localhost")
        LOCAL_DB_PORT = os.environ.get("LOCAL_DB_PORT", "5432")
        LOCAL_DB_NAME = os.environ.get("LOCAL_DB_NAME", "bdent")
        LOCAL_DB_USER = os.environ.get("LOCAL_DB_USER", "postgres")
        LOCAL_DB_PASSWORD = os.environ.get("LOCAL_DB_PASSWORD", "postgres")
        SQLALCHEMY_DATABASE_URL = f"postgresql://{LOCAL_DB_USER}:{LOCAL_DB_PASSWORD}@{LOCAL_DB_HOST}:{LOCAL_DB_PORT}/{LOCAL_DB_NAME}"
    else:
        SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL")
        if not SQLALCHEMY_DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is required for cloud mode")
    
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    # Tables that need sync fields added
    tables = [
        'clinics',
        'users',
        'patients',
        'reports',
        'treatment_types',
        'referring_doctors',
        'payments',
        'appointments',
        'subscriptions',
        'scheduled_messages',
        'invoices',
        'invoice_line_items',
        'invoice_audit_logs',
        'attendance',
        'xray_images'
    ]
    
    with engine.connect() as connection:
        with connection.begin():
            for table in tables:
                try:
                    # Check if columns already exist
                    check_updated_at = connection.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='{table}' AND column_name='updated_at'
                    """))
                    
                    has_updated_at = check_updated_at.fetchone() is not None
                    
                    # Add updated_at if it doesn't exist
                    if not has_updated_at:
                        print(f"Adding updated_at to {table}...")
                        connection.execute(text(f"""
                            ALTER TABLE {table} 
                            ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        """))
                        
                        # Set updated_at to created_at for existing records
                        connection.execute(text(f"""
                            UPDATE {table} 
                            SET updated_at = created_at 
                            WHERE updated_at IS NULL
                        """))
                        
                        # Add trigger to update updated_at on update
                        connection.execute(text(f"""
                            CREATE OR REPLACE FUNCTION update_updated_at_column()
                            RETURNS TRIGGER AS $$
                            BEGIN
                                NEW.updated_at = CURRENT_TIMESTAMP;
                                RETURN NEW;
                            END;
                            $$ language 'plpgsql';
                        """))
                        
                        connection.execute(text(f"""
                            DROP TRIGGER IF EXISTS update_{table}_updated_at ON {table};
                            CREATE TRIGGER update_{table}_updated_at 
                            BEFORE UPDATE ON {table} 
                            FOR EACH ROW 
                            EXECUTE FUNCTION update_updated_at_column();
                        """))
                    else:
                        print(f"updated_at already exists in {table}, skipping...")
                    
                    # Add synced_at if it doesn't exist
                    check_synced_at = connection.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='{table}' AND column_name='synced_at'
                    """))
                    
                    has_synced_at = check_synced_at.fetchone() is not None
                    
                    if not has_synced_at:
                        print(f"Adding synced_at to {table}...")
                        connection.execute(text(f"""
                            ALTER TABLE {table} 
                            ADD COLUMN synced_at TIMESTAMP
                        """))
                    else:
                        print(f"synced_at already exists in {table}, skipping...")
                    
                    # Add sync_status if it doesn't exist
                    check_sync_status = connection.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='{table}' AND column_name='sync_status'
                    """))
                    
                    has_sync_status = check_sync_status.fetchone() is not None
                    
                    if not has_sync_status:
                        print(f"Adding sync_status to {table}...")
                        connection.execute(text(f"""
                            ALTER TABLE {table} 
                            ADD COLUMN sync_status VARCHAR(20) DEFAULT 'local'
                        """))
                    else:
                        print(f"sync_status already exists in {table}, skipping...")
                    
                    # Add indexes for efficient sync queries
                    print(f"Adding indexes to {table}...")
                    connection.execute(text(f"""
                        CREATE INDEX IF NOT EXISTS idx_{table}_updated_at ON {table}(updated_at)
                    """))
                    connection.execute(text(f"""
                        CREATE INDEX IF NOT EXISTS idx_{table}_synced_at ON {table}(synced_at)
                    """))
                    connection.execute(text(f"""
                        CREATE INDEX IF NOT EXISTS idx_{table}_sync_status ON {table}(sync_status)
                    """))
                    
                except Exception as e:
                    print(f"Error processing {table}: {e}")
                    # Continue with other tables
                    continue
    
    print("\n✅ Sync timestamp fields added successfully!")

if __name__ == "__main__":
    try:
        add_sync_timestamps()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


