#!/usr/bin/env python3
"""
Migration script to add appointments table
Run this script to add the appointments table to your database
"""

import os
import sys
from database import engine

def run_migration():
    """Run the appointments table migration"""
    try:
        # Read the SQL migration file
        migration_file = os.path.join(os.path.dirname(__file__), 'migrations', 'add_appointments_table.sql')
        
        with open(migration_file, 'r') as f:
            sql = f.read()
        
        print("🚀 Running migration: Add Appointments Table...")
        
        # Execute the SQL directly using SQLAlchemy
        with engine.connect() as conn:
            # Split SQL into individual statements
            statements = [s.strip() for s in sql.split(';') if s.strip()]
            for statement in statements:
                if statement:
                    conn.execute(statement)
            conn.commit()
        
        print("✅ Migration completed successfully!")
        print("   - Created 'appointments' table")
        print("   - Added indexes for performance")
        print("   - Created updated_at trigger")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        print("\nPlease run the SQL manually from migrations/add_appointments_table.sql")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)





