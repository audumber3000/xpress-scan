#!/usr/bin/env python3

from database import engine
from sqlalchemy import text

def check_db_defaults():
    """Check for database defaults, constraints, and triggers that might be causing MRN generation"""
    try:
        with engine.connect() as db:
            # Check for any triggers on the patients table
            result = db.execute(text("""
                SELECT trigger_name, event_manipulation, action_statement
                FROM information_schema.triggers
                WHERE event_object_table = 'patients'
            """))
            
            print("Triggers on patients table:")
            for row in result:
                print(f"{row[0]}: {row[1]} - {row[2][:200]}...")
            
            # Check for any default values on the patients table
            result = db.execute(text("""
                SELECT column_name, column_default, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'patients'
                AND column_default IS NOT NULL
            """))
            
            print("\nDefault values on patients table:")
            for row in result:
                print(f"{row[0]}: {row[1]} (nullable: {row[2]})")
                
            # Check for any check constraints
            result = db.execute(text("""
                SELECT constraint_name, check_clause
                FROM information_schema.check_constraints
                WHERE check_clause LIKE '%display_id%'
            """))
            
            print("\nCheck constraints with display_id:")
            for row in result:
                print(f"{row[0]}: {row[1]}")
                
            # Check for any foreign key constraints that might reference display_id
            result = db.execute(text("""
                SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
                       ccu.table_name AS foreign_table_name,
                       ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND (kcu.column_name LIKE '%display_id%' OR ccu.column_name LIKE '%display_id%')
            """))
            
            print("\nForeign key constraints with display_id:")
            for row in result:
                print(f"{row[0]}: {row[1]}.{row[2]} -> {row[3]}.{row[4]}")
                
    except Exception as e:
        print(f"Error checking database defaults: {e}")

if __name__ == "__main__":
    check_db_defaults()
