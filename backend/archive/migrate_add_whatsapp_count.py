#!/usr/bin/env python3
"""
Migration script to add whatsapp_sent_count field to reports table
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine
from sqlalchemy import text

def migrate_add_whatsapp_count():
    """Add whatsapp_sent_count field to reports table"""
    try:
        with engine.connect() as conn:
            # Check if whatsapp_sent_count column already exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'reports' AND column_name = 'whatsapp_sent_count'
            """))
            
            if result.fetchone():
                print("✅ WhatsApp sent count column already exists in reports table")
                return
            
            # Add whatsapp_sent_count column
            conn.execute(text("""
                ALTER TABLE reports 
                ADD COLUMN whatsapp_sent_count INTEGER DEFAULT 0
            """))
            
            conn.commit()
            print("✅ Successfully added whatsapp_sent_count column to reports table")
            
    except Exception as e:
        print(f"❌ Error adding whatsapp_sent_count column: {e}")
        raise

if __name__ == "__main__":
    migrate_add_whatsapp_count() 