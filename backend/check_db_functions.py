#!/usr/bin/env python3

from database import engine
from sqlalchemy import text

def check_db_functions():
    """Check for database functions that might contain display_id references"""
    try:
        with engine.connect() as db:
            # Check for functions with display_id
            result = db.execute(text("""
                SELECT routine_name, routine_definition 
                FROM information_schema.routines 
                WHERE routine_type = 'FUNCTION' 
                AND routine_definition LIKE '%display_id%'
            """))
            
            print("Functions with display_id:")
            for row in result:
                print(f"{row[0]}: {row[1][:200]}...")
            
            # Check for triggers
            result = db.execute(text("""
                SELECT trigger_name, event_manipulation, action_statement
                FROM information_schema.triggers
                WHERE action_statement LIKE '%display_id%'
            """))
            
            print("\nTriggers with display_id:")
            for row in result:
                print(f"{row[0]}: {row[2][:200]}...")
                
            # Check for any tables with display_id column
            result = db.execute(text("""
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE column_name = 'display_id'
            """))
            
            print("\nTables with display_id column:")
            for row in result:
                print(f"{row[0]}.{row[1]}")
                
    except Exception as e:
        print(f"Error checking database: {e}")

if __name__ == "__main__":
    check_db_functions()
