#!/usr/bin/env python3
"""
Test script to verify week view logic
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db
from models import Payment, Patient
from datetime import datetime, timedelta

def test_week_view_logic():
    """Test the week view logic directly"""
    
    # Get database session
    db = next(get_db())
    
    try:
        # Get all payments for clinic_id = 3
        payments = db.query(Payment).filter(Payment.clinic_id == 3).all()
        print(f"💰 Total payments found: {len(payments)}")
        
        # Test the week view logic
        today = datetime.now()
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=7)
        
        print(f"🔍 Week calculation:")
        print(f"   Today: {today}")
        print(f"   Start of week: {start_of_week}")
        print(f"   End of week: {end_of_week}")
        
        weekly_data = {}
        for payment in payments:
            if payment.created_at and payment.status == 'success':
                payment_date = payment.created_at
                if start_of_week <= payment_date < end_of_week:
                    day_key = payment_date.strftime("%Y-%m-%d")
                    time_key = payment_date.strftime("%H:%M")
                    
                    print(f"✅ Payment {payment.id} matches week:")
                    print(f"   Date: {day_key}, Time: {time_key}")
                    print(f"   Amount: {payment.amount}")
                    print(f"   Patient ID: {payment.patient_id}")
                    
                    if day_key not in weekly_data:
                        weekly_data[day_key] = {
                            "revenue": 0,
                            "patients": []
                        }
                    
                    # Add revenue
                    weekly_data[day_key]["revenue"] += payment.amount
                    
                    # Add patient info
                    patient = db.query(Patient).filter(Patient.id == payment.patient_id).first()
                    if patient:
                        print(f"   Patient: {patient.name}, Scan: {patient.scan_type}")
                        weekly_data[day_key]["patients"].append({
                            "id": patient.id,
                            "name": patient.name,
                            "scan_type": patient.scan_type,
                            "time": time_key,
                            "amount": payment.amount,
                            "payment_method": payment.payment_method
                        })
                    else:
                        print(f"   ❌ Patient not found!")
        
        print(f"\n🔍 Final weekly_data structure:")
        print(f"   Keys: {list(weekly_data.keys())}")
        for key, value in weekly_data.items():
            print(f"   {key}: revenue={value['revenue']}, patients={len(value['patients'])}")
            if value['patients']:
                for patient in value['patients']:
                    print(f"     - {patient['name']} at {patient['time']}")
        
        return weekly_data
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None
    finally:
        db.close()

if __name__ == "__main__":
    test_week_view_logic()
