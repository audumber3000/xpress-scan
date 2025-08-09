from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from models import Patient, Payment, Report

def generate_medical_id(db: Session, record_type: str, year: int = None) -> str:
    """
    Generate medical standard ID with global sequential numbering
    
    Args:
        db: Database session
        record_type: 'patient', 'payment', or 'report'
        year: Year (defaults to current year)
    
    Returns:
        Medical ID string: MRN-2025-00001, INV-2025-00001, RAD-2025-00001
    """
    if year is None:
        year = datetime.now().year
    
    # Map record types to prefixes and table names
    config = {
        'patient': {'prefix': 'MRN', 'table': 'patients'},
        'payment': {'prefix': 'INV', 'table': 'payments'},
        'report': {'prefix': 'RAD', 'table': 'reports'}
    }
    
    if record_type not in config:
        raise ValueError(f"Invalid record_type: {record_type}")
    
    prefix = config[record_type]['prefix']
    table = config[record_type]['table']
    
    # Get the count of existing records with display_id for this year
    # This ensures globally unique sequential numbering
    query = text(f"""
        SELECT COUNT(*) FROM {table} 
        WHERE display_id LIKE :pattern
    """)
    
    pattern = f"{prefix}-{year}-%"
    result = db.execute(query, {"pattern": pattern})
    count = result.scalar() or 0
    
    # Generate next sequential number (5 digits, zero-padded)
    next_number = count + 1
    number_part = f"{next_number:05d}"
    
    return f"{prefix}-{year}-{number_part}"

def get_next_patient_mrn(db: Session) -> str:
    """Generate next Medical Record Number for patient"""
    return generate_medical_id(db, 'patient')

def get_next_invoice_number(db: Session) -> str:
    """Generate next Invoice Number for payment"""
    return generate_medical_id(db, 'payment')

def get_next_report_number(db: Session) -> str:
    """Generate next Report Number for radiology report"""
    return generate_medical_id(db, 'report')

# Example usage:
# patient_id = get_next_patient_mrn(db)  # MRN-2025-00007
# invoice_id = get_next_invoice_number(db)  # INV-2025-00002
# report_id = get_next_report_number(db)  # RAD-2025-00015
