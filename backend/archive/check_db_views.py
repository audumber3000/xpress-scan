#!/usr/bin/env python3

from database import engine
from sqlalchemy import text

def check_db_views():
    """Check for database views that might contain display_id references"""
    try:
        with engine.connect() as db:
            # Check for views with display_id
            result = db.execute(text("""
                SELECT table_name, view_definition
                FROM information_schema.views
                WHERE view_definition LIKE '%display_id%'
            """))
            
            print("Views with display_id:")
            for row in result:
                print(f"{row[0]}: {row[1][:200]}...")
            
            # Check for materialized views
            result = db.execute(text("""
                SELECT matviewname, definition
                FROM pg_matviews
                WHERE definition LIKE '%display_id%'
            """))
            
            print("\nMaterialized views with display_id:")
            for row in result:
                print(f"{row[0]}: {row[1][:200]}...")
                
            # Check for any active queries or sessions
            result = db.execute(text("""
                SELECT pid, query_start, state, query
                FROM pg_stat_activity
                WHERE state = 'active'
                AND query LIKE '%display_id%'
            """))
            
            print("\nActive queries with display_id:")
            for row in result:
                print(f"PID {row[0]}: {row[3][:200]}...")
                
    except Exception as e:
        print(f"Error checking database views: {e}")

if __name__ == "__main__":
    check_db_views()
