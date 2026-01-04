import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from database import SQLALCHEMY_DATABASE_URL

if __name__ == "__main__":
    print("Adding razorpay_customer_id column to clinics table...")
    print(f"Database URL: {os.getenv('DATABASE_URL', 'Not set')[:50]}...")
    
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    try:
        with engine.connect() as conn:
            # Check if column already exists
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='clinics' AND column_name='razorpay_customer_id'
            """)
            result = conn.execute(check_query)
            exists = result.fetchone()
            
            if exists:
                print("✅ Column razorpay_customer_id already exists")
            else:
                # Add the column
                alter_query = text("""
                    ALTER TABLE clinics 
                    ADD COLUMN razorpay_customer_id VARCHAR
                """)
                conn.execute(alter_query)
                conn.commit()
                print("✅ Column razorpay_customer_id added successfully!")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)



