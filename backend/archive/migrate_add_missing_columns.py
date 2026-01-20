import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def add_missing_columns_to_all_tables():
    """Add missing columns (updated_at, synced_at, sync_status) to all tables that need them"""
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL or SUPABASE_URL environment variable not set")
        return
    
    engine = create_engine(database_url)
    
    # Tables that need these columns based on models.py
    tables = [
        'clinics',  # Added clinics table
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
            try:
                for table in tables:
                    print(f"\nProcessing {table}...")
                    
                    # First check if table exists
                    check_table = connection.execute(text(f"""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_name='{table}'
                    """))
                    
                    if check_table.fetchone() is None:
                        print(f"  ⚠️  Table {table} does not exist, skipping...")
                        continue
                    
                    # Check and add updated_at
                    check_updated_at = connection.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='{table}' AND column_name='updated_at'
                    """))
                    
                    if check_updated_at.fetchone() is None:
                        print(f"  Adding updated_at to {table}...")
                        connection.execute(text(f"""
                            ALTER TABLE {table} 
                            ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        """))
                        
                        # Check if created_at exists before trying to use it
                        check_created_at = connection.execute(text(f"""
                            SELECT column_name 
                            FROM information_schema.columns 
                            WHERE table_name='{table}' AND column_name='created_at'
                        """))
                        
                        if check_created_at.fetchone() is not None:
                            # Set updated_at to created_at for existing records
                            connection.execute(text(f"""
                                UPDATE {table} 
                                SET updated_at = created_at 
                                WHERE updated_at IS NULL
                            """))
                        else:
                            # If no created_at, just set to current timestamp
                            connection.execute(text(f"""
                                UPDATE {table} 
                                SET updated_at = CURRENT_TIMESTAMP 
                                WHERE updated_at IS NULL
                            """))
                        print(f"  ✅ Added updated_at to {table}")
                    else:
                        print(f"  ✅ updated_at already exists in {table}")
                    
                    # Check and add synced_at
                    check_synced_at = connection.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='{table}' AND column_name='synced_at'
                    """))
                    
                    if check_synced_at.fetchone() is None:
                        print(f"  Adding synced_at to {table}...")
                        connection.execute(text(f"""
                            ALTER TABLE {table} 
                            ADD COLUMN synced_at TIMESTAMP
                        """))
                        print(f"  ✅ Added synced_at to {table}")
                    else:
                        print(f"  ✅ synced_at already exists in {table}")
                    
                    # Check and add sync_status
                    check_sync_status = connection.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='{table}' AND column_name='sync_status'
                    """))
                    
                    if check_sync_status.fetchone() is None:
                        print(f"  Adding sync_status to {table}...")
                        connection.execute(text(f"""
                            ALTER TABLE {table} 
                            ADD COLUMN sync_status VARCHAR(20) DEFAULT 'local'
                        """))
                        
                        # Set default value for existing records
                        connection.execute(text(f"""
                            UPDATE {table} 
                            SET sync_status = 'local' 
                            WHERE sync_status IS NULL
                        """))
                        print(f"  ✅ Added sync_status to {table}")
                    else:
                        print(f"  ✅ sync_status already exists in {table}")
                
                print("\n✅ All required columns have been added to all tables!")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
                raise

if __name__ == "__main__":
    add_missing_columns_to_all_tables()

