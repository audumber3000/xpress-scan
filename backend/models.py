from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Float, Table
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import uuid
import datetime

Base = declarative_base()


def generate_clinic_code():
    """Generate a strong unique clinic ID like CLN-A3X9K2B7FQ"""
    import random, string
    chars = string.ascii_uppercase + string.digits
    code = ''.join(random.choices(chars, k=10))
    return f"CLN-{code}"


# Association table for User-Clinic Many-to-Many
user_clinics = Table(
    'user_clinics',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('clinic_id', Integer, ForeignKey('clinics.id'), primary_key=True),
    Column('role', String, default='receptionist'), # Specific role in this clinic
    Column('is_active', Boolean, default=True),
    Column('created_at', DateTime, default=datetime.datetime.utcnow)
)

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
    clinic_code = Column(String(14), unique=True, nullable=True, index=True, default=generate_clinic_code)  # e.g. CLN-A3X9K2B7FQ
    name = Column(String, nullable=False)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    gst_number = Column(String)
    specialization = Column(String, default='dental')  # dental, cardiology, pathology, etc.
    subscription_plan = Column(String, default='free')  # free, professional, enterprise
    status = Column(String, default='active')  # active, suspended, cancelled
    razorpay_customer_id = Column(String, nullable=True)  # Razorpay customer ID
    cashfree_customer_id = Column(String, nullable=True)  # Cashfree customer ID
    logo_url = Column(String)
    invoice_template = Column(String, default='modern_orange')
    primary_color = Column(String, default='#10B981')  # Green default
    number_of_chairs = Column(Integer, default=1)  # Number of dental chairs
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
    referred_by_code = Column(String, nullable=True)  # Which referral code was used to sign up

    # Relationships
    users = relationship("User", secondary=user_clinics, back_populates="clinics")

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True)  # Current/Default clinic
    email = Column(String, nullable=False, unique=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    name = Column(String, nullable=False)  # Full name of the user (computed from first_name + last_name)
    role = Column(String, nullable=False, default='receptionist')  # clinic_owner, doctor, receptionist
    permissions = Column(JSON, default=dict)
    dashboard_preferences = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    supabase_user_id = Column(String, nullable=True)  # Link to Supabase auth user
    password_hash = Column(String, nullable=True)  # Password hash for OAuth users who want desktop access
    signature_url = Column(Text, nullable=True)  # Base64 signature image for prescriptions/documents
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)  # Who created this user
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    
    # Relationships
    clinics = relationship("Clinic", secondary=user_clinics, back_populates="users")
    active_clinic = relationship("Clinic", foreign_keys=[clinic_id])
    created_users = relationship("User", backref="creator", remote_side=[id])

class Patient(Base):
    __tablename__ = 'patients'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    village = Column(String, nullable=True)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    referred_by = Column(String, nullable=True)
    treatment_type = Column(String, nullable=False)
    blood_group = Column(String, nullable=True)
    patient_history = Column(Text, nullable=True)
    display_id = Column(String, nullable=True, index=True)
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

class Prescription(Base):
    """Dedicated prescription table — one record per prescription (per visit)."""
    __tablename__ = 'prescriptions'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)  # Linked visit
    visit_number = Column(Integer, nullable=True)   # Denormalised for quick display
    items = Column(JSON, nullable=False, default=list)  # List of medication dicts
    notes = Column(Text, nullable=True)
    pdf_url = Column(String, nullable=True)         # Set after PDF generation
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    appointment = relationship("Appointment")

class ClinicalSetting(Base):
    __tablename__ = 'clinical_settings'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True)  # Null for system-wide defaults
    category = Column(String, nullable=False, index=True)  # complaint, finding, diagnosis, medical-condition
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")

class CasePaper(Base):
    __tablename__ = 'case_papers'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)
    dentist_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default='In Progress')  # In Progress, Completed
    
    chief_complaint = Column(Text, nullable=True)  # Stored as JSON string or plain text
    medical_history = Column(JSON, nullable=True, default=list)  # List of condition names
    dental_history = Column(Text, nullable=True)   # Stored as JSON string or plain text
    allergies = Column(JSON, nullable=True, default=list)        # List of allergen names
    clinical_examination = Column(Text, nullable=True)
    diagnosis = Column(Text, nullable=True)
    next_visit_recommendation = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Clinical Snapshots (Point-in-time state for this visit)
    dental_chart_snapshot = Column(JSON, nullable=True)
    treatment_plan_snapshot = Column(JSON, nullable=True)
    tooth_notes_snapshot = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    appointment = relationship("Appointment")
    dentist = relationship("User")


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


class DashboardReport(Base):
    __tablename__ = 'dashboard_reports'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    report_category = Column(String, nullable=False)  # Financial, Operational, Clinical, Marketing
    report_type = Column(String, nullable=False)      # p_l_statement, staff_productivity, etc.
    title = Column(String, nullable=False)
    parameters = Column(JSON, default=dict)           # Stores date range, filtered values
    status = Column(String, default='completed')      # generating, completed, failed
    file_url = Column(String, nullable=True)          # URL to the generated PDF
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")
    creator = relationship("User", foreign_keys=[created_by])

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

class Expense(Base):
    __tablename__ = 'expenses'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    vendor_id = Column(Integer, ForeignKey('vendors.id'), nullable=True)
    amount = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False)  # Cash, UPI, Card, Net Banking, etc.
    category = Column(String, nullable=False, default='General')  # E.g., Inventory, Salary, Rent, Utilities, Maintenance
    notes = Column(Text, nullable=True)
    bill_file_url = Column(String, nullable=True)  # URL to uploaded bill image/pdf
    date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    clinic = relationship("Clinic")
    vendor = relationship("Vendor")
    creator = relationship("User", foreign_keys=[created_by])

class Appointment(Base):
    __tablename__ = 'appointments'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=True)  # Can be null for walk-ins
    patient_name = Column(String, nullable=False)  # Store name directly for quick access
    patient_email = Column(String, nullable=True)
    patient_phone = Column(String, nullable=True)
    doctor_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # Assigned doctor
    treatment = Column(String, nullable=True)  # Treatment type or description
    appointment_date = Column(DateTime, nullable=False)  # Date and start time combined
    start_time = Column(String, nullable=False)  # e.g., "09:00"
    end_time = Column(String, nullable=False)  # e.g., "10:30"
    duration = Column(Integer, nullable=False, default=60)  # Duration in minutes
    status = Column(String, default='confirmed')  # confirmed, completed, cancelled, no-show
    notes = Column(Text, nullable=True)  # Additional notes
    chair_number = Column(String, nullable=True)  # Assigned chair number
    visit_number = Column(Integer, nullable=True)  # Visit number from treatment plan
    patient_age = Column(Integer, nullable=True)
    patient_gender = Column(String, nullable=True)
    patient_village = Column(String, nullable=True)
    patient_referred_by = Column(String, nullable=True)
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
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True, unique=True)  # Still useful but optional
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True) # Linked to the owner/subscriber
    razorpay_subscription_id = Column(String, nullable=True, unique=True)  # Deprecated in favor of provider_subscription_id
    razorpay_customer_id = Column(String, nullable=True)
    razorpay_plan_id = Column(String, nullable=True)
    
    # Generic Provider Fields
    provider = Column(String, nullable=False, default='razorpay')  # razorpay, cashfree
    provider_subscription_id = Column(String, nullable=True, unique=True, index=True)
    provider_customer_id = Column(String, nullable=True)
    provider_plan_id = Column(String, nullable=True)
    provider_order_id = Column(String, nullable=True, index=True) # Used for some checkout flows
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

class SubscriptionCoupon(Base):
    __tablename__ = 'subscription_coupons'
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    discount_percent = Column(Float, nullable=True)  # Discount in percentage
    discount_amount = Column(Float, nullable=True)   # Fixed discount amount
    is_active = Column(Boolean, default=True)
    expiry_date = Column(DateTime, nullable=True)
    usage_limit = Column(Integer, default=100)
    used_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ReferralCode(Base):
    __tablename__ = 'referral_codes'
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    creator_name = Column(String, nullable=False)  # Who this code belongs to (content creator, agency)
    discount_percent = Column(Float, nullable=True)  # Discount for the clinic using it
    reward_details = Column(JSON, nullable=True)  # Details on how the creator gets paid/rewarded
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


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
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)
    invoice_number = Column(String, nullable=False, index=True)  # Auto-generated: INV-YYYY-XXXX
    status = Column(String, nullable=False, default='draft')  # draft, finalized, partially_paid, paid_unverified, paid_verified, cancelled
    payment_mode = Column(String, nullable=True)  # UPI, Cash, Card, etc.
    utr = Column(String, nullable=True)  # UTR number for UPI payments
    subtotal = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    discount_type = Column(String, default='amount')  # 'amount' or 'percentage'
    discount_amount = Column(Float, default=0.0)  # The finalized deduction value
    total = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    paid_at = Column(DateTime, nullable=True)
    finalized_at = Column(DateTime, nullable=True)
    paid_amount = Column(Float, default=0.0)
    due_amount = Column(Float, default=0.0)
    
    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    creator = relationship("User", foreign_keys=[created_by])
    appointment = relationship("Appointment")
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

# Relationships are already defined in the classes above

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

class Vendor(Base):
    __tablename__ = 'vendors'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)
    contact_name = Column(String)
    email = Column(String)
    phone = Column(String)
    address = Column(String)
    gst_number = Column(String)
    category = Column(String, default='General')
    last_order_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")

class InventoryItem(Base):
    __tablename__ = 'inventory_items'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    vendor_id = Column(Integer, ForeignKey('vendors.id'), nullable=True)
    name = Column(String, nullable=False)
    category = Column(String)  # Consumables, Equipment, etc.
    quantity = Column(Float, default=0.0)
    unit = Column(String)  # pcs, ml, mg, etc.
    min_stock_level = Column(Float, default=0.0)
    price_per_unit = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")
    vendor = relationship("Vendor")

class ConsentTemplate(Base):
    __tablename__ = 'consent_templates'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)
    content = Column(Text, nullable=False)  # HTML or Markdown with variables
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")

class PatientConsent(Base):
    __tablename__ = 'patient_consents'
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    template_id = Column(Integer, ForeignKey('consent_templates.id'), nullable=False)
    signed_content = Column(Text)  # Final content when signed
    signature_url = Column(String)  # Path to signature image
    signed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    patient = relationship("Patient")
    template = relationship("ConsentTemplate")

class PatientDocument(Base):
    __tablename__ = 'patient_documents'
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    case_paper_id = Column(Integer, ForeignKey('case_papers.id'), nullable=True)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # S3 or local path
    file_size = Column(Integer)
    file_type = Column(String)  # pdf, dicom, png, etc.
    uploaded_by = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    patient = relationship("Patient")
    clinic = relationship("Clinic")
    case_paper = relationship("CasePaper")
    uploader = relationship("User")

class WhatsAppChat(Base):
    __tablename__ = 'whatsapp_chats'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    phone_number = Column(String, nullable=False, index=True) # The person the user is chatting with
    chat_id_serialized = Column(String, nullable=True) # Full chat ID from WhatsApp
    contact_name = Column(String, nullable=True)
    unread_count = Column(Integer, default=0)
    profile_pic_url = Column(String, nullable=True)
    last_message = Column(Text, nullable=True)
    last_message_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")
    user = relationship("User")
    
class WhatsAppMessage(Base):
    __tablename__ = 'whatsapp_messages'
    id = Column(String, primary_key=True, index=True) # WhatsApp message ID (e.g. false_1234567890@c.us_3Axyz)
    chat_id = Column(Integer, ForeignKey('whatsapp_chats.id'), nullable=False)
    from_phone = Column(String, nullable=False)
    from_name = Column(String, nullable=True)
    body = Column(Text, nullable=True)
    timestamp = Column(DateTime, nullable=False)
    type = Column(String, nullable=False, default='chat')
    is_group = Column(Boolean, default=False)
    has_media = Column(Boolean, default=False)
    media_url = Column(String, nullable=True) # Could be Base64 or an S3 URL
    is_sent = Column(Boolean, default=False)
    status = Column(String, default='pending') # pending, sent, delivered, read, played, error
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    chat = relationship("WhatsAppChat")

class Medication(Base):
    __tablename__ = 'medications'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True) # Null for global/system medications
    name = Column(String, nullable=False)
    dosage = Column(String, nullable=True) # Default dosage e.g. "1-0-1"
    duration = Column(String, nullable=True) # Default duration e.g. "5 days"
    quantity = Column(String, nullable=True) # Default quantity
    notes = Column(Text, nullable=True)
    category = Column(String, default='General')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")

class TemplateConfiguration(Base):
    __tablename__ = 'template_configurations'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    category = Column(String, nullable=False)  # 'invoice', 'prescription', 'consent'
    template_id = Column(String, nullable=False, default='default')
    logo_url = Column(String, nullable=True)
    footer_text = Column(Text, nullable=True)
    primary_color = Column(String, nullable=True)
    secondary_color = Column(String, nullable=True)
    config_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")
class ClinicalAsset(Base):
    __tablename__ = "clinical_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) 
    category = Column(String)         
    r2_storage_key = Column(String)   
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class LabOrder(Base):
    __tablename__ = 'lab_orders'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    case_paper_id = Column(Integer, ForeignKey('case_papers.id'), nullable=True)
    vendor_id = Column(Integer, ForeignKey('vendors.id'), nullable=False)
    
    work_type = Column(String, nullable=False)  # Crown, Bridge, Denture, etc.
    tooth_number = Column(String, nullable=True) # e.g. "46", "UR6"
    shade = Column(String, nullable=True)
    instructions = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=True)
    status = Column(String, default='Draft')    # Draft, Sent, Received, Completed, Cancelled
    cost = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    case_paper = relationship("CasePaper")
    vendor = relationship("Vendor")


class NotificationPreference(Base):
    __tablename__ = 'notification_preferences'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    event_type = Column(String, nullable=False)   # appointment_confirmation, invoice, etc.
    channel = Column(String, nullable=True)        # kept for legacy; use channels below
    channels = Column(JSON, default=list)          # ["whatsapp", "email", "sms"] — multi-select
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")


class NotificationLog(Base):
    __tablename__ = 'notification_logs'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    channel = Column(String, nullable=False)           # whatsapp, email, sms
    recipient = Column(String, nullable=False)          # phone or email address
    event_type = Column(String, nullable=True)          # what triggered this notification
    template_name = Column(String, nullable=True)
    status = Column(String, default='queued')           # queued, sent, delivered, read, failed
    cost = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    provider_message_id = Column(String, nullable=True, index=True)  # MSG91 request_id for webhook correlation
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")


class NotificationWallet(Base):
    __tablename__ = 'notification_wallets'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, unique=True, index=True)
    balance = Column(Float, default=0.0)
    last_topup_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")


class WalletTransaction(Base):
    __tablename__ = 'wallet_transactions'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    transaction_type = Column(String, nullable=False)  # credit, debit
    description = Column(String, nullable=True)
    order_id = Column(String, nullable=True)            # Cashfree order ID for topups
    status = Column(String, default='completed')        # pending, completed, failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    clinic = relationship("Clinic")


class ActivityLog(Base):
    __tablename__ = 'activity_logs'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    event_type = Column(String, nullable=False)        # e.g. patient_added, prescription_saved
    description = Column(String, nullable=False)       # Human-readable message
    link = Column(String, nullable=True)               # Optional deep-link path
    actor_name = Column(String, nullable=True)         # Who triggered the action
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    clinic = relationship("Clinic")


class GooglePlaceLink(Base):
    __tablename__ = 'google_place_links'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, unique=True, index=True)
    place_id = Column(String, nullable=False)
    place_name = Column(String, nullable=True)
    place_address = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    current_rating = Column(Float, nullable=True)
    total_review_count = Column(Integer, default=0)
    last_synced_at = Column(DateTime, nullable=True)
    linked_at = Column(DateTime, default=datetime.datetime.utcnow)
    linked_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    clinic = relationship("Clinic")


class GoogleReview(Base):
    __tablename__ = 'google_reviews'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    place_id = Column(String, nullable=False, index=True)
    review_hash = Column(String, nullable=False, unique=True)  # SHA256(place_id+author+time)
    author_name = Column(String, nullable=True)
    author_url = Column(String, nullable=True)
    profile_photo_url = Column(String, nullable=True)
    rating = Column(Integer, nullable=False)            # 1-5
    text = Column(Text, nullable=True)
    review_time = Column(DateTime, nullable=True)       # Original Google review timestamp
    synced_at = Column(DateTime, default=datetime.datetime.utcnow)

    clinic = relationship("Clinic")


class CompetitorSnapshot(Base):
    __tablename__ = 'competitor_snapshots'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    place_id = Column(String, nullable=False, index=True)  # Google Place ID
    review_count = Column(Integer, nullable=False, default=0)
    rating = Column(Float, nullable=False, default=0.0)
    snapshot_date = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    clinic = relationship("Clinic")


class CompetitorCache(Base):
    __tablename__ = 'competitor_caches'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    place_id = Column(String, nullable=False, index=True)
    scope = Column(String, nullable=False)  # '5km' or 'city'
    results = Column(JSON, nullable=False)
    synced_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    clinic = relationship("Clinic")


class SupportTicket(Base):
    __tablename__ = 'support_tickets'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    assigned_to = Column(Integer, ForeignKey('users.id'), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, default='other')      # billing / setup / bug / feature / other
    status = Column(String, default='open')          # open / in_progress / resolved / closed
    priority = Column(String, default='normal')      # low / normal / high / urgent
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")
    creator = relationship("User", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assigned_to])
    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan")


class SupportMessage(Base):
    __tablename__ = 'support_messages'
    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey('support_tickets.id'), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    body = Column(Text, nullable=False)
    is_staff = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    ticket = relationship("SupportTicket", back_populates="messages")
    sender = relationship("User")
