import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_user_devices_table():
    """Create user_devices table"""
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL or SUPABASE_URL environment variable not set")
        return
    
    engine = create_engine(database_url)
    
    with engine.connect() as connection:
        with connection.begin():
            try:
                # Check if table exists
                check_table = connection.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_name='user_devices'
                """))
                
                if check_table.fetchone() is None:
                    print("Creating user_devices table...")
                    connection.execute(text("""
                        CREATE TABLE user_devices (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            device_name VARCHAR(255) NOT NULL,
                            device_type VARCHAR(50) NOT NULL,
                            device_platform VARCHAR(100),
                            device_os VARCHAR(255),
                            device_serial VARCHAR(255),
                            user_agent TEXT,
                            ip_address VARCHAR(50),
                            location VARCHAR(255),
                            is_active BOOLEAN DEFAULT TRUE,
                            is_online BOOLEAN DEFAULT FALSE,
                            last_seen TIMESTAMP,
                            allowed_access JSONB DEFAULT '{"desktop": true, "mobile": true, "web": true}'::jsonb,
                            enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            assigned_at TIMESTAMP,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            synced_at TIMESTAMP,
                            sync_status VARCHAR(20) DEFAULT 'local'
                        )
                    """))
                    print("✅ Created user_devices table")
                else:
                    print("✅ user_devices table already exists")
                
                print("\n✅ User devices setup complete!")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
                raise

if __name__ == "__main__":
    create_user_devices_table()

