#!/usr/bin/env python3
"""
Setup test database for DDD testing
"""
import os
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Set test environment variables
os.environ["USE_LOCAL_DB"] = "true"
os.environ["LOCAL_DB_HOST"] = "localhost"
os.environ["LOCAL_DB_PORT"] = "5432"
os.environ["LOCAL_DB_NAME"] = "xpress_scan_test"
os.environ["LOCAL_DB_USER"] = "postgres"
os.environ["LOCAL_DB_PASSWORD"] = "postgres"

def setup_test_database():
    """Create and initialize test database"""
    try:
        from database import engine
        from models import Base

        print("Creating test database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Test database setup complete!")

        return True

    except Exception as e:
        print(f"❌ Failed to setup test database: {e}")
        print("\nMake sure PostgreSQL is running and you can connect to it.")
        print("You may need to:")
        print("1. Install PostgreSQL: brew install postgresql")
        print("2. Start PostgreSQL: brew services start postgresql")
        print("3. Create database: createdb xpress_scan_test")
        return False

def check_database_connection():
    """Check if we can connect to the test database"""
    try:
        import psycopg2

        conn = psycopg2.connect(
            host=os.environ["LOCAL_DB_HOST"],
            port=os.environ["LOCAL_DB_PORT"],
            database=os.environ["LOCAL_DB_NAME"],
            user=os.environ["LOCAL_DB_USER"],
            password=os.environ["LOCAL_DB_PASSWORD"]
        )
        conn.close()
        print("✅ Database connection successful!")
        return True

    except ImportError:
        print("❌ psycopg2 not installed. Install with: pip install psycopg2-binary")
        return False
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure PostgreSQL is running: brew services list | grep postgres")
        print("2. Create test database: createdb xpress_scan_test")
        print("3. Check connection: psql -h localhost -U postgres -d xpress_scan_test")
        return False

if __name__ == "__main__":
    print("Setting up test database for DDD structure...")

    # Check database connection first
    if not check_database_connection():
        sys.exit(1)

    # Setup database tables
    if setup_test_database():
        print("\n🎉 Test database is ready!")
        print("Run tests with: python run_ddd_tests.py all")
    else:
        sys.exit(1)