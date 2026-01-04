import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_message_templates_table():
    """Create message_templates table and add default templates for existing clinics"""
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL or SUPABASE_URL environment variable not set")
        return
    
    engine = create_engine(database_url)
    
    with engine.connect() as connection:
        with connection.begin():
            try:
                # Check if table exists
                check_table = connection.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_name='message_templates'
                """))
                
                if check_table.fetchone() is None:
                    print("Creating message_templates table...")
                    connection.execute(text("""
                        CREATE TABLE message_templates (
                            id SERIAL PRIMARY KEY,
                            clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
                            name VARCHAR(255) NOT NULL,
                            title VARCHAR(255) NOT NULL,
                            content TEXT NOT NULL,
                            variables JSONB DEFAULT '[]'::jsonb,
                            is_active BOOLEAN DEFAULT TRUE,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            synced_at TIMESTAMP,
                            sync_status VARCHAR(20) DEFAULT 'local',
                            UNIQUE(clinic_id, name)
                        )
                    """))
                    print("✅ Created message_templates table")
                else:
                    print("✅ message_templates table already exists")
                
                # Get all clinics
                clinics = connection.execute(text("SELECT id, name FROM clinics"))
                clinics_list = clinics.fetchall()
                
                print(f"\nProcessing {len(clinics_list)} clinic(s)...")
                
                for clinic_id, clinic_name in clinics_list:
                    # Check if default templates exist
                    existing_welcome = connection.execute(text("""
                        SELECT id FROM message_templates 
                        WHERE clinic_id = :clinic_id AND name = 'welcome'
                    """), {"clinic_id": clinic_id}).fetchone()
                    
                    existing_invoice = connection.execute(text("""
                        SELECT id FROM message_templates 
                        WHERE clinic_id = :clinic_id AND name = 'invoice'
                    """), {"clinic_id": clinic_id}).fetchone()
                    
                    # Create welcome template if it doesn't exist
                    if not existing_welcome:
                        welcome_content = f"Welcome to {clinic_name}, {{patient_name}}! We're glad to have you as our patient. Your treatment type is {{treatment_type}}. If you have any questions, please don't hesitate to reach out."
                        connection.execute(text("""
                            INSERT INTO message_templates (clinic_id, name, title, content, variables, is_active)
                            VALUES (:clinic_id, 'welcome', 'Welcome Message', :content, :variables, TRUE)
                        """), {
                            "clinic_id": clinic_id,
                            "content": welcome_content,
                            "variables": '["patient_name", "clinic_name", "treatment_type", "phone"]'
                        })
                        print(f"  ✅ Created welcome template for clinic {clinic_id}")
                    
                    # Create invoice template if it doesn't exist
                    if not existing_invoice:
                        invoice_content = "Dear {{patient_name}},\n\nYour invoice #{{invoice_number}} is ready.\n\nTotal Amount: {{total_amount}}\n\nPlease find the invoice PDF attached.\n\nThank you,\n{{clinic_name}}"
                        connection.execute(text("""
                            INSERT INTO message_templates (clinic_id, name, title, content, variables, is_active)
                            VALUES (:clinic_id, 'invoice', 'Invoice Message', :content, :variables, TRUE)
                        """), {
                            "clinic_id": clinic_id,
                            "content": invoice_content,
                            "variables": '["patient_name", "clinic_name", "invoice_number", "invoice_id", "total_amount", "subtotal", "tax", "payment_mode"]'
                        })
                        print(f"  ✅ Created invoice template for clinic {clinic_id}")
                
                print("\n✅ Message templates setup complete!")
                
            except Exception as e:
                print(f"❌ Error: {e}")
                import traceback
                traceback.print_exc()
                raise

if __name__ == "__main__":
    create_message_templates_table()

