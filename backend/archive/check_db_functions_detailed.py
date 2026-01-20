#!/usr/bin/env python3

from database import engine
from sqlalchemy import text

def check_db_functions_detailed():
    """Check for any database functions that might be running automatically"""
    try:
        with engine.connect() as db:
            # Check for all functions in the database
            result = db.execute(text("""
                SELECT routine_name, routine_definition
                FROM information_schema.routines
                WHERE routine_type = 'FUNCTION'
                AND routine_schema = 'public'
            """))
            
            print("All database functions:")
            for row in result:
                print(f"{row[0]}: {row[1][:300]}...")
            
            # Check for any functions that might be related to MRN or patient creation
            result = db.execute(text("""
                SELECT routine_name, routine_definition
                FROM information_schema.routines
                WHERE routine_type = 'FUNCTION'
                AND routine_schema = 'public'
                AND (routine_definition LIKE '%MRN%' 
                     OR routine_definition LIKE '%patient%' 
                     OR routine_definition LIKE '%COALESCE%'
                     OR routine_definition LIKE '%SUBSTRING%')
            """))
            
            print("\nFunctions related to MRN/patients:")
            for row in result:
                print(f"{row[0]}: {row[1][:300]}...")
                
            # Check for any functions that might be called on INSERT
            result = db.execute(text("""
                SELECT routine_name, routine_definition
                FROM information_schema.routines
                WHERE routine_type = 'FUNCTION'
                AND routine_schema = 'public'
                AND routine_definition LIKE '%INSERT%'
            """))
            
            print("\nFunctions with INSERT logic:")
            for row in result:
                print(f"{row[0]}: {row[1][:300]}...")
                
    except Exception as e:
        print(f"Error checking database functions: {e}")

if __name__ == "__main__":
    check_db_functions_detailed()
