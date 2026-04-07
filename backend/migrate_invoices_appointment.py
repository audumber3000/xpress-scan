
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("Migrating invoices table...")
    try:
        # Check if visit_id needs renaming or if we just add appointment_id
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='invoices' AND column_name='visit_id';")
        has_visit_id = cur.fetchone()
        
        if has_visit_id:
            print("Renaming visit_id to appointment_id and adding foreign key...")
            cur.execute("ALTER TABLE invoices RENAME COLUMN visit_id TO appointment_id;")
            cur.execute("ALTER TABLE invoices ALTER COLUMN appointment_id TYPE INTEGER USING appointment_id::integer;")
            cur.execute("ALTER TABLE invoices ADD CONSTRAINT fk_invoices_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id);")
        else:
            print("Adding appointment_id column and foreign key...")
            cur.execute("ALTER TABLE invoices ADD COLUMN appointment_id INTEGER REFERENCES appointments(id);")
            
        conn.commit()
        print("Migration successful!")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()
