"""
Migration script to add invoice tables (invoices, invoice_line_items, invoice_audit_logs)
Run this script to create the invoice-related tables in your database.
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine
from models import Base, Invoice, InvoiceLineItem, InvoiceAuditLog

def create_invoice_tables():
    """Create invoice-related tables"""
    try:
        print("Creating invoice tables...")
        
        # Create tables for Invoice, InvoiceLineItem, and InvoiceAuditLog
        Base.metadata.create_all(bind=engine, tables=[
            Invoice.__table__,
            InvoiceLineItem.__table__,
            InvoiceAuditLog.__table__
        ])
        
        print("✅ Invoice tables created successfully!")
        print("   - invoices")
        print("   - invoice_line_items")
        print("   - invoice_audit_logs")
        
        return True
    except Exception as e:
        print(f"❌ Error creating invoice tables: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("Invoice Tables Migration")
    print("=" * 50)
    
    success = create_invoice_tables()
    
    if success:
        print("\n✅ Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)







