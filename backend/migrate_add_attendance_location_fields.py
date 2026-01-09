import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def add_attendance_location_fields():
    """Add location fields to attendance table for clock in/out geofencing"""
    database_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL or SUPABASE_URL environment variable not set")
        return
    
    engine = create_engine(database_url)
    
    with engine.connect() as connection:
        with connection.begin():
            try:
                print("\nProcessing attendance table...")
                
                # Add clock_in_time and clock_out_time (aliases for check_in_time and check_out_time)
                # Actually, we'll use the existing check_in_time and check_out_time
                # Just add location fields
                
                fields_to_add = [
                    ('clock_in_latitude', 'DOUBLE PRECISION'),
                    ('clock_in_longitude', 'DOUBLE PRECISION'),
                    ('clock_in_address', 'VARCHAR(500)'),
                    ('clock_in_accuracy', 'DOUBLE PRECISION'),
                    ('clock_out_latitude', 'DOUBLE PRECISION'),
                    ('clock_out_longitude', 'DOUBLE PRECISION'),
                    ('clock_out_address', 'VARCHAR(500)'),
                    ('clock_out_accuracy', 'DOUBLE PRECISION'),
                    ('hours_worked', 'DOUBLE PRECISION'),
                ]
                
                for field_name, field_type in fields_to_add:
                    check_column = connection.execute(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='attendance' AND column_name='{field_name}'
                    """))
                    
                    if check_column.fetchone() is None:
                        print(f"  Adding {field_name} to attendance...")
                        connection.execute(text(f"""
                            ALTER TABLE attendance 
                            ADD COLUMN {field_name} {field_type}
                        """))
                        print(f"  ✅ Added {field_name} to attendance")
                    else:
                        print(f"  ✅ {field_name} already exists in attendance")
                
                print("\n✅ Migration completed successfully!")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
                raise

if __name__ == "__main__":
    add_attendance_location_fields()





