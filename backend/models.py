from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

class MessageTemplate(Base):
    __tablename__ = 'message_templates'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)  # e.g., "welcome", "invoice"
    title = Column(String, nullable=False)  # Display name e.g., "Welcome Message", "Invoice Message"
    content = Column(Text, nullable=False)  # Template content with placeholders
    variables = Column(JSON, default=list)  # List of available variables like ["{patient_name}", "{clinic_name}"]
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')
    
    clinic = relationship("Clinic")

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
    razorpay_customer_id = Column(String, nullable=True)  # Razorpay customer ID
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
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'

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
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
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
    
    # Dental History & Planning data (stored as JSON for flexibility)
    dental_chart = Column(JSON, nullable=True)  # Stores teethData
    tooth_notes = Column(JSON, nullable=True)   # Stores tooth-specific notes
    treatment_plan = Column(JSON, nullable=True) # Stores the proposed treatment sequence
    prescriptions = Column(JSON, nullable=True)  # Stores clinical prescriptions
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
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
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    clinic = relationship("Clinic")
    patient = relationship("Patient")

class TreatmentType(Base):
    __tablename__ = 'treatment_types'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)  # Price in INR (Indian Rupees)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    clinic = relationship("Clinic")

class ReferringDoctor(Base):
    __tablename__ = 'referring_doctors'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)
    hospital = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
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
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    
    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    report = relationship("Report")
    treatment_type = relationship("TreatmentType")
    received_by_user = relationship("User", foreign_keys=[received_by])

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
    visit_number = Column(Integer, nullable=True)  # Visit number from treatment plan
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    
    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    doctor = relationship("User", foreign_keys=[doctor_id])
    creator = relationship("User", foreign_keys=[created_by])

class Subscription(Base):
    __tablename__ = 'subscriptions'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, unique=True)
    razorpay_subscription_id = Column(String, nullable=True, unique=True)  # Razorpay subscription ID
    razorpay_customer_id = Column(String, nullable=True)  # Razorpay customer ID
    razorpay_plan_id = Column(String, nullable=True)  # Razorpay plan ID
    plan_name = Column(String, nullable=False, default='free')  # free, professional, enterprise
    status = Column(String, nullable=False, default='active')  # active, paused, cancelled, expired
    current_start = Column(DateTime, nullable=True)  # Current billing period start
    current_end = Column(DateTime, nullable=True)  # Current billing period end
    quantity = Column(Integer, default=1)  # Number of subscriptions
    notes = Column(JSON, nullable=True)  # Additional metadata from Razorpay
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    
    # Relationships
    clinic = relationship("Clinic", backref="subscription")

class ScheduledMessage(Base):
    __tablename__ = 'scheduled_messages'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    message = Column(Text, nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String, default='pending')  # pending, sent, failed, cancelled
    recipient_count = Column(Integer, default=0)
    patient_ids = Column(JSON, default=list)  # List of patient IDs
    sent_count = Column(Integer, default=0)  # How many were successfully sent
    failed_count = Column(Integer, default=0)  # How many failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    sent_at = Column(DateTime, nullable=True)
    
    clinic = relationship("Clinic")
    user = relationship("User")

class Invoice(Base):
    __tablename__ = 'invoices'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    visit_id = Column(Integer, nullable=True)  # Link to visit/appointment if exists
    invoice_number = Column(String, nullable=False, index=True)  # Auto-generated: INV-YYYY-XXXX
    status = Column(String, nullable=False, default='draft')  # draft, paid_unverified, paid_verified, cancelled
    payment_mode = Column(String, nullable=True)  # UPI, Cash, Card, etc.
    utr = Column(String, nullable=True)  # UTR number for UPI payments
    subtotal = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    paid_at = Column(DateTime, nullable=True)
    
    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    creator = relationship("User", foreign_keys=[created_by])
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    audit_logs = relationship("InvoiceAuditLog", back_populates="invoice", cascade="all, delete-orphan")

class InvoiceLineItem(Base):
    __tablename__ = 'invoice_line_items'
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey('invoices.id'), nullable=False)
    description = Column(String, nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)  # quantity * unit_price
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    
    # Relationships
    invoice = relationship("Invoice", back_populates="line_items")

class InvoiceAuditLog(Base):
    __tablename__ = 'invoice_audit_logs'
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey('invoices.id'), nullable=False)
    action = Column(String, nullable=False)  # created, updated, marked_paid, line_item_added, line_item_updated, line_item_deleted
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    
    # Relationships
    invoice = relationship("Invoice", back_populates="audit_logs")
    user = relationship("User")

class Attendance(Base):
    __tablename__ = 'attendance'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # Employee
    date = Column(DateTime, nullable=False)  # Date of attendance
    status = Column(String, nullable=False, default='on_time')  # on_time, late, absent, holiday
    check_in_time = Column(DateTime, nullable=True)  # Actual check-in time
    check_out_time = Column(DateTime, nullable=True)  # Actual check-out time
    reason = Column(String, nullable=True)  # Reason for late/absent
    notes = Column(Text, nullable=True)
    marked_by = Column(Integer, ForeignKey('users.id'), nullable=True)  # Who marked the attendance
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    
    # Relationships
    clinic = relationship("Clinic")
    user = relationship("User", foreign_keys=[user_id])
    marker = relationship("User", foreign_keys=[marked_by])

class XrayImage(Base):
    __tablename__ = 'xray_images'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)
    file_path = Column(String, nullable=False)  # DICOM file path
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    image_type = Column(String, nullable=False)  # 'bitewing', 'panoramic', 'periapical', etc.
    capture_date = Column(DateTime, nullable=False)
    brightness = Column(Float, nullable=True)  # Editing metadata
    contrast = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    
    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    appointment = relationship("Appointment", foreign_keys=[appointment_id])
    creator = relationship("User", foreign_keys=[created_by])

# Update relationships
Clinic.users = relationship("User", back_populates="clinic")

class UserDevice(Base):
    __tablename__ = 'user_devices'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    device_name = Column(String, nullable=False)  # e.g., "John's MacBook Pro"
    device_type = Column(String, nullable=False)  # 'desktop', 'mobile', 'web'
    device_platform = Column(String, nullable=True)  # 'Windows', 'macOS', 'iOS', 'Android', 'Linux'
    device_os = Column(String, nullable=True)  # OS version
    device_serial = Column(String, nullable=True)  # Device serial number or unique identifier
    user_agent = Column(Text, nullable=True)  # Full user agent string
    ip_address = Column(String, nullable=True)  # IP address
    location = Column(String, nullable=True)  # Location (city, country)
    is_active = Column(Boolean, default=True)  # Device is currently active
    is_online = Column(Boolean, default=False)  # Device is currently online
    last_seen = Column(DateTime, nullable=True)  # Last activity timestamp
    allowed_access = Column(JSON, default=dict)  # Access restrictions: {"desktop": true, "mobile": false, "web": true}
    enrolled_at = Column(DateTime, default=datetime.datetime.utcnow)
    assigned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')
    
    user = relationship("User")