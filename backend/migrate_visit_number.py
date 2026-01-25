"""
Migration script to add visit_number column to appointments table
"""
from database import SessionLocal
from sqlalchemy import text

def add_visit_number_column():
    db = SessionLocal()
    try:
        # Check if column already exists (PostgreSQL version)
        result = db.execute(text("""
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = 'public' 
            AND TABLE_NAME = 'appointments' 
            AND COLUMN_NAME = 'visit_number'
        """))
        
        column_exists = result.scalar() > 0
        
        if column_exists:
            print("✅ Column 'visit_number' already exists in appointments table")
        else:
            # Add the column
            db.execute(text("ALTER TABLE appointments ADD COLUMN visit_number INT NULL"))
            db.commit()
            print("✅ Successfully added 'visit_number' column to appointments table")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔄 Running migration to add visit_number column...")
    add_visit_number_column()
    print("✅ Migration complete!")
