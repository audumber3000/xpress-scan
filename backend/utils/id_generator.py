from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from models import Patient, Payment, Report
import time

def generate_medical_id(db: Session, record_type: str, year: int = None, max_retries: int = 5) -> str:
    """
    Generate medical standard ID with retry mechanism to handle concurrent insertions
    
    Args:
        db: Database session
        record_type: 'patient', 'payment', or 'report'
        year: Year (defaults to current year)
        max_retries: Maximum number of retry attempts
    
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
    
    for attempt in range(max_retries):
        try:
            # Use a more robust approach: get the highest existing number and increment
            query = text(f"""
                SELECT COALESCE(MAX(CAST(SUBSTRING(display_id FROM LENGTH(:prefix) + 6) AS INTEGER)), 0)
                FROM {table} 
                WHERE display_id LIKE :pattern
            """)
            
            pattern = f"{prefix}-{year}-%"
            result = db.execute(query, {"pattern": pattern, "prefix": prefix})
            max_number = result.scalar() or 0
            
            # Generate next sequential number (5 digits, zero-padded)
            next_number = max_number + 1
            number_part = f"{next_number:05d}"
            new_id = f"{prefix}-{year}-{number_part}"
            
            # Verify this ID doesn't exist (double-check for race conditions)
            verify_query = text(f"SELECT COUNT(*) FROM {table} WHERE display_id = :id")
            verify_result = db.execute(verify_query, {"id": new_id})
            exists = verify_result.scalar() or 0
            
            if exists == 0:
                return new_id
            
            # If ID exists, wait a bit and retry
            time.sleep(0.1 * (attempt + 1))
            
        except Exception as e:
            print(f"Error generating ID (attempt {attempt + 1}): {e}")
            if attempt == max_retries - 1:
                raise
            time.sleep(0.1 * (attempt + 1))
    
    # If we get here, all retries failed
    raise Exception(f"Failed to generate unique ID after {max_retries} attempts")

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
