"""
Migration script to create xray_images table
Run this script to add X-ray image storage support
"""

import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv

load_dotenv()

def migrate_xray_table():
    """Create xray_images table"""
    
    # Database connection
    db_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'database': os.getenv('DB_NAME', 'dental_clinic'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', 'postgres'),
        'port': os.getenv('DB_PORT', '5432')
    }
    
    conn = None
    try:
        conn = psycopg2.connect(**db_config)
        conn.autocommit = False
        cur = conn.cursor()
        
        print("Creating xray_images table...")
        
        # Create xray_images table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS xray_images (
                id SERIAL PRIMARY KEY,
                clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
                file_path VARCHAR(500) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_size INTEGER NOT NULL,
                image_type VARCHAR(50) NOT NULL,
                capture_date TIMESTAMP NOT NULL,
                brightness FLOAT,
                contrast FLOAT,
                notes TEXT,
                created_by INTEGER NOT NULL REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_xray_images_clinic_id ON xray_images(clinic_id)
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_xray_images_patient_id ON xray_images(patient_id)
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_xray_images_appointment_id ON xray_images(appointment_id)
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_xray_images_capture_date ON xray_images(capture_date)
        """)
        
        conn.commit()
        print("✅ xray_images table created successfully!")
        
        # Create uploads directory
        upload_dir = os.path.join(os.path.dirname(__file__), "uploads", "xray")
        os.makedirs(upload_dir, exist_ok=True)
        print(f"✅ Created uploads directory: {upload_dir}")
        
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(f"❌ Database error: {e}")
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("X-ray Images Migration")
    print("=" * 60)
    migrate_xray_table()
    print("=" * 60)
    print("Migration completed!")
    print("=" * 60)


