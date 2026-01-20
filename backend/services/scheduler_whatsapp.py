"""
Scheduler service to send scheduled WhatsApp messages
Run this as a background service or cron job (runs every minute)
"""
import os
import sys
import time
import re
import requests
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db
from models import ScheduledMessage, Patient
from sqlalchemy.orm import Session

# WhatsApp Service URL
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")

def send_scheduled_messages():
    """Check for and send scheduled messages that are due"""
    db: Session = next(get_db())
    
    try:
        # Find messages that are due (scheduled in the past)
        now = datetime.utcnow()
        
        # Get pending messages that are due
        scheduled_messages = db.query(ScheduledMessage).filter(
            ScheduledMessage.status == 'pending',
            ScheduledMessage.scheduled_at <= now
        ).all()
        
        if not scheduled_messages:
            return
        
        print(f"[{datetime.now()}] Found {len(scheduled_messages)} scheduled message(s) to send")
        
        for scheduled_msg in scheduled_messages:
            try:
                # Update status to processing
                scheduled_msg.status = 'processing'
                db.commit()
                
                # Get patient phone numbers
                patients = db.query(Patient).filter(
                    Patient.id.in_(scheduled_msg.patient_ids),
                    Patient.clinic_id == scheduled_msg.clinic_id
                ).all()
                
                sent_count = 0
                failed_count = 0
                
                # Send messages with rate limiting (12 seconds between messages)
                delay_between_messages = 12
                
                for i, patient in enumerate(patients):
                    try:
                        # Clean phone number (remove non-digits)
                        clean_phone = re.sub(r'\D', '', str(patient.phone))
                        
                        # Send via WhatsApp service
                        response = requests.post(
                            f"{WHATSAPP_SERVICE_URL}/api/send/{scheduled_msg.user_id}",
                            json={
                                "phone": clean_phone,
                                "message": scheduled_msg.message
                            },
                            timeout=60
                        )
                        
                        if response.status_code == 200 and response.json().get("success"):
                            sent_count += 1
                            print(f"  ✅ Sent to {patient.name} ({patient.phone})")
                        else:
                            failed_count += 1
                            print(f"  ❌ Failed to send to {patient.name} ({patient.phone})")
                    except Exception as e:
                        failed_count += 1
                        print(f"  ❌ Error sending to {patient.name}: {str(e)}")
                    
                    # Wait before sending next message (except for the last one)
                    if i < len(patients) - 1:
                        time.sleep(delay_between_messages)
                
                # Update scheduled message status
                scheduled_msg.status = 'sent' if failed_count == 0 else 'partial'
                scheduled_msg.sent_count = sent_count
                scheduled_msg.failed_count = failed_count
                scheduled_msg.sent_at = datetime.utcnow()
                db.commit()
                
                print(f"  ✅ Completed: {sent_count} sent, {failed_count} failed")
                
            except Exception as e:
                print(f"  ❌ Error processing scheduled message {scheduled_msg.id}: {str(e)}")
                scheduled_msg.status = 'failed'
                db.commit()
                
    except Exception as e:
        print(f"Error in scheduler: {str(e)}")
        db.rollback()
    finally:
        db.close()


def run_scheduler():
    """Run scheduler loop - checks every minute"""
    print("WhatsApp Scheduler started. Checking for scheduled messages every minute...")
    print(f"Service URL: {WHATSAPP_SERVICE_URL}")
    
    while True:
        try:
            send_scheduled_messages()
        except Exception as e:
            print(f"Error in scheduler loop: {str(e)}")
        
        # Wait 60 seconds before next check
        time.sleep(60)


if __name__ == "__main__":
    # If run directly, check once and exit (useful for cron)
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--loop":
        # Run continuously (for systemd service)
        run_scheduler()
    else:
        # Run once (for cron)
        send_scheduled_messages()

