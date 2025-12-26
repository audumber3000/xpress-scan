"""
Test script to verify appointments table and create a test appointment
"""
from database import SessionLocal
from models import Appointment, User, Clinic
from sqlalchemy import text
import datetime

def test_appointments():
    db = SessionLocal()
    
    try:
        # Test 1: Check if appointments table exists
        print("🔍 Test 1: Checking if appointments table exists...")
        try:
            result = db.execute(text("SELECT COUNT(*) FROM appointments")).scalar()
            print(f"✅ Appointments table exists! Current count: {result}")
        except Exception as e:
            print(f"❌ Appointments table does NOT exist!")
            print(f"   Error: {str(e)}")
            print("\n📋 Please run this SQL in Supabase SQL Editor:")
            print("=" * 80)
            with open('migrations/add_appointments_table.sql', 'r') as f:
                print(f.read())
            print("=" * 80)
            return
        
        # Test 2: Get a test user and clinic
        print("\n🔍 Test 2: Finding test user and clinic...")
        user = db.query(User).first()
        if not user:
            print("❌ No users found in database")
            return
        
        print(f"✅ Found user: {user.name} (ID: {user.id}, Clinic ID: {user.clinic_id})")
        
        # Test 3: Create a test appointment
        print("\n🔍 Test 3: Creating test appointment...")
        test_appointment = Appointment(
            clinic_id=user.clinic_id,
            patient_name="Test Patient",
            patient_email="test@example.com",
            patient_phone="+1234567890",
            treatment="Test Checkup",
            appointment_date=datetime.datetime.now() + datetime.timedelta(days=1),
            start_time="10:00",
            end_time="11:00",
            duration=60,
            status="confirmed",
            created_by=user.id
        )
        
        db.add(test_appointment)
        db.commit()
        db.refresh(test_appointment)
        
        print(f"✅ Test appointment created successfully!")
        print(f"   ID: {test_appointment.id}")
        print(f"   Patient: {test_appointment.patient_name}")
        print(f"   Date: {test_appointment.appointment_date}")
        print(f"   Time: {test_appointment.start_time} - {test_appointment.end_time}")
        
        # Test 4: Query the appointment
        print("\n🔍 Test 4: Querying appointments...")
        appointments = db.query(Appointment).filter(
            Appointment.clinic_id == user.clinic_id
        ).all()
        print(f"✅ Found {len(appointments)} appointment(s) for clinic ID {user.clinic_id}")
        
        for apt in appointments:
            print(f"   - {apt.patient_name} on {apt.appointment_date} at {apt.start_time}")
        
        print("\n🎉 All tests passed! Appointment system is working!")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error occurred: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 80)
    print("🚀 Testing Appointments System")
    print("=" * 80)
    test_appointments()

