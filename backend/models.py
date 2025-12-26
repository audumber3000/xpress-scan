from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

class Clinic(Base):
    __tablename__ = 'clinics'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    gst_number = Column(String)
    specialization = Column(String, default='dental')  # dental, cardiology, pathology, etc.
    subscription_plan = Column(String, default='free')  # free, professional, enterprise
    status = Column(String, default='active')  # active, suspended, cancelled
    logo_url = Column(String)
    primary_color = Column(String, default='#10B981')  # Green default
    timings = Column(JSON, default=lambda: {
        'monday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'tuesday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'wednesday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'thursday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'friday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'saturday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'sunday': {'open': '08:00', 'close': '20:00', 'closed': True}
    })  # Operating hours for each day
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="clinic")

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True)  # Can be null during signup
    email = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    name = Column(String, nullable=False)  # Full name of the user (computed from first_name + last_name)
    role = Column(String, nullable=False, default='receptionist')  # clinic_owner, doctor, receptionist
    permissions = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    supabase_user_id = Column(String, nullable=True)  # Link to Supabase auth user
    password_hash = Column(String, nullable=True)  # Password hash for OAuth users who want desktop access
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)  # Who created this user
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    clinic = relationship("Clinic", back_populates="users")
    created_users = relationship("User", backref="creator", remote_side=[id])

class Patient(Base):
    __tablename__ = 'patients'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    village = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    referred_by = Column(String, nullable=False)
    treatment_type = Column(String, nullable=False)
    notes = Column(Text)
    payment_type = Column(String, nullable=False, default="Cash")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    clinic = relationship("Clinic")

class Report(Base):
    __tablename__ = 'reports'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    docx_url = Column(String)
    pdf_url = Column(String)
    content = Column(Text)  # Store the actual report content for drafts
    status = Column(String, default='draft')
    whatsapp_sent_count = Column(Integer, default=0)  # Track how many times WhatsApp was sent
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    clinic = relationship("Clinic")
    patient = relationship("Patient")

class TreatmentType(Base):
    __tablename__ = 'treatment_types'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)  # Price in INR (Indian Rupees)
    is_active = Column(Boolean, default=True)
    clinic = relationship("Clinic")

class ReferringDoctor(Base):
    __tablename__ = 'referring_doctors'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)
    hospital = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    clinic = relationship("Clinic")

class Payment(Base):
    __tablename__ = 'payments'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    report_id = Column(Integer, ForeignKey('reports.id'), nullable=True)  # Link to report if payment is for a report
    treatment_type_id = Column(Integer, ForeignKey('treatment_types.id'), nullable=True)  # Link to treatment type for pricing
    amount = Column(Float, nullable=False)  # Amount in INR (Indian Rupees)
    payment_method = Column(String, nullable=False)  # Cash, Card, PayPal, Net Banking, UPI, etc.
    status = Column(String, nullable=False, default='success')  # success, pending, failed, refunded
    transaction_id = Column(String, nullable=True)  # External transaction ID if applicable
    notes = Column(Text, nullable=True)
    paid_by = Column(String, nullable=True)  # Who made the payment (if different from patient)
    received_by = Column(Integer, ForeignKey('users.id'), nullable=True)  # Staff member who received payment
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    report = relationship("Report")
    treatment_type = relationship("TreatmentType")
    received_by_user = relationship("User", foreign_keys=[received_by])

class WhatsAppConfiguration(Base):
    __tablename__ = 'whatsapp_configurations'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    api_key = Column(String, nullable=False)  # Rapiwha API key
    phone_number = Column(String, nullable=True)  # Optional: user's WhatsApp number
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    clinic = relationship("Clinic")

class Appointment(Base):
    __tablename__ = 'appointments'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=True)  # Can be null for walk-ins
    patient_name = Column(String, nullable=False)  # Store name directly for quick access
    patient_email = Column(String, nullable=True)
    patient_phone = Column(String, nullable=True)
    doctor_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # Assigned doctor
    treatment = Column(String, nullable=False)  # Treatment type or description
    appointment_date = Column(DateTime, nullable=False)  # Date and start time combined
    start_time = Column(String, nullable=False)  # e.g., "09:00"
    end_time = Column(String, nullable=False)  # e.g., "10:30"
    duration = Column(Integer, nullable=False, default=60)  # Duration in minutes
    status = Column(String, default='confirmed')  # confirmed, completed, cancelled, no-show
    notes = Column(Text, nullable=True)  # Additional notes
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    doctor = relationship("User", foreign_keys=[doctor_id])
    creator = relationship("User", foreign_keys=[created_by])

# Update relationships
Clinic.users = relationship("User", back_populates="clinic")