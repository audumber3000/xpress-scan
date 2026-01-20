#!/usr/bin/env python3

from database import engine
from sqlalchemy import text

def check_db_triggers():
    """Check for any database triggers that might be running automatically"""
    try:
        with engine.connect() as db:
            # Check for all triggers in the database
            result = db.execute(text("""
                SELECT trigger_name, event_object_table, event_manipulation, 
                       action_timing, action_statement
                FROM information_schema.triggers
                WHERE trigger_schema = 'public'
            """))
            
            print("All database triggers:")
            for row in result:
                print(f"{row[0]} on {row[1]} ({row[2]}, {row[3]}): {row[4][:200]}...")
            
            # Check specifically for triggers on the patients table
            result = db.execute(text("""
                SELECT trigger_name, event_manipulation, action_timing, action_statement
                FROM information_schema.triggers
                WHERE event_object_table = 'patients'
                AND trigger_schema = 'public'
            """))
            
            print("\nTriggers specifically on patients table:")
            for row in result:
                print(f"{row[0]} ({row[1]}, {row[2]}): {row[3][:200]}...")
                
            # Check for any functions that might be called by triggers
            result = db.execute(text("""
                SELECT p.proname, p.prosrc
                FROM pg_proc p
                JOIN pg_trigger t ON p.oid = t.tgfoid
                WHERE t.tgrelid = 'patients'::regclass
            """))
            
            print("\nFunctions called by triggers on patients table:")
            for row in result:
                print(f"{row[0]}: {row[1][:200]}...")
                
    except Exception as e:
        print(f"Error checking database triggers: {e}")

if __name__ == "__main__":
    check_db_triggers()
