import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def add_created_at_to_treatment_types():
    """Add created_at column to treatment_types table if it doesn't exist"""
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL or SUPABASE_URL environment variable not set")
        return
    
    engine = create_engine(database_url)
    
    with engine.connect() as connection:
        with connection.begin():
            try:
                print("\nProcessing treatment_types table...")
                
                # Check if table exists
                check_table = connection.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_name='treatment_types'
                """))
                
                if check_table.fetchone() is None:
                    print("  ⚠️  Table treatment_types does not exist, skipping...")
                    return
                
                # Check if created_at already exists
                check_created_at = connection.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='treatment_types' AND column_name='created_at'
                """))
                
                if check_created_at.fetchone() is None:
                    print("  Adding created_at to treatment_types...")
                    connection.execute(text("""
                        ALTER TABLE treatment_types 
                        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    """))
                    
                    # Set created_at to current timestamp for existing records
                    connection.execute(text("""
                        UPDATE treatment_types 
                        SET created_at = CURRENT_TIMESTAMP 
                        WHERE created_at IS NULL
                    """))
                    print("  ✅ Added created_at to treatment_types")
                else:
                    print("  ✅ created_at already exists in treatment_types")
                
                print("\n✅ Migration completed successfully!")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
                raise

if __name__ == "__main__":
    add_created_at_to_treatment_types()

