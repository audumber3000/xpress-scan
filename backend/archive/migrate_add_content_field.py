#!/usr/bin/env python3
"""
Migration script to add content field to reports table
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine
from sqlalchemy import text

def migrate_add_content_field():
    """Add content field to reports table"""
    try:
        with engine.connect() as conn:
            # Check if content column already exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'reports' AND column_name = 'content'
            """))
            
            if result.fetchone():
                print("✅ Content column already exists in reports table")
                return
            
            # Add content column
            conn.execute(text("""
                ALTER TABLE reports 
                ADD COLUMN content TEXT
            """))
            
            conn.commit()
            print("✅ Successfully added content column to reports table")
            
    except Exception as e:
        print(f"❌ Error adding content column: {e}")
        raise

if __name__ == "__main__":
    migrate_add_content_field() 