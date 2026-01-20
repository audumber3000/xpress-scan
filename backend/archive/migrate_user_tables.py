import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_tables():
    # Get database URL from environment variables
    database_url = os.getenv('SUPABASE_URL')
    
    if not database_url:
        raise ValueError("SUPABASE_URL environment variable not set")
    
    # Create SQLAlchemy engine
    engine = create_engine(database_url)
    
    # SQL to create tables
    sql_commands = """
    -- Create clinic_users table
    CREATE TABLE IF NOT EXISTS clinic_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('doctor', 'receptionist')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES clinic_users(id),
        is_active BOOLEAN DEFAULT TRUE,
        doctor_id INTEGER REFERENCES clinic_users(id)
    );
    
    -- Create user_permissions table
    CREATE TABLE IF NOT EXISTS user_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES clinic_users(id) ON DELETE CASCADE,
        section VARCHAR(50) NOT NULL,
        can_view BOOLEAN DEFAULT FALSE,
        can_edit BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, section)
    );
    
    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
    """
    
    # Execute the SQL commands
    with engine.connect() as connection:
        with connection.begin():
            # Split the SQL commands and execute them one by one
            for statement in sql_commands.split(';'):
                if statement.strip():
                    connection.execute(text(statement + ';'))
    
    print("Database tables created or verified successfully!")

if __name__ == "__main__":
    try:
        create_tables()
    except Exception as e:
        print(f"Error creating tables: {e}")
        raise
