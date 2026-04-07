import os
import sys
import json
import jwt
import time
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:password@127.0.0.1:5433/postgres")
JWT_SECRET = os.environ.get("JWT_SECRET", "0235a446421b8acb0874e382f46c1d680b1ba646eda4f5092fba84ed2fed6b38")
API_URL = "http://localhost:8000/api/v1" # Assuming uvicorn is running on 8000

def get_test_token():
    # Construct a token for a test user (clinic owner)
    # We'll use ID 1 and Clinic ID 1 as a guess, or we can look it up
    payload = {
        "sub": "test@example.com",
        "user_id": 1,
        "clinic_id": 1,
        "role": "clinic_owner",
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def test_api():
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Testing Appointment Creation (without treatment/chair)...")
    apt_data = {
        "patient_name": "Test Patient",
        "patient_email": "test@patient.com",
        "patient_phone": "1234567890",
        "patient_age": 30,
        "clinic_id": 1,
        "appointment_date": datetime.now().strftime("%Y-%m-%d"),
        "start_time": "14:00",
        "end_time": "15:00",
        "duration": 60,
        "status": "confirmed"
    }
    
    try:
        response = requests.post(f"{API_URL}/appointments", json=apt_data, headers=headers)
        if response.status_code == 200:
            appointment = response.json()
            apt_id = appointment['id']
            print(f"✅ Appointment created successfully! ID: {apt_id}")
            
            print("\nTesting Appointment Check-in (update with treatment/chair)...")
            checkin_data = {
                "treatment": "Root Canal",
                "chair_number": "2",
                "status": "checking",
                "patient_age": 31,
                "patient_gender": "Female",
                "patient_village": "Test Village",
                "patient_referred_by": "Dr. Smith"
            }
            
            update_response = requests.put(f"{API_URL}/appointments/{apt_id}", json=checkin_data, headers=headers)
            if update_response.status_code == 200:
                print("✅ Appointment checked in successfully!")
                print(json.dumps(update_response.json(), indent=2))
            else:
                print(f"❌ Check-in failed: {update_response.status_code} - {update_response.text}")
        else:
            print(f"❌ Creation failed: {response.status_code} - {response.text}")
            print("Note: Ensure the backend server is running on http://localhost:8000")
    except Exception as e:
        print(f"❌ Error connecting to API: {e}")

if __name__ == "__main__":
    test_api()
