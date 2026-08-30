from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Text, JSON, Float, Table, UniqueConstraint
from sqlalchemy.orm import relationship, backref
from sqlalchemy.ext.declarative import declarative_base
import uuid
import datetime

# The plan catalogue, so the column defaults below cannot drift from it again.
# Safe to import at module scope: core.plans imports nothing from models.
from core import plans

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
    # Printed under the clinic name on letterheads. Until now the renderers
    # asked for this with getattr and a hardcoded default, so every clinic's
    # documents said "Comprehensive Dental & Orthodontic Care" whether that was
    # true or not. Real column, blank by default, clinic types its own.
    tagline = Column(String(120), nullable=True)
    address = Column(String)
    phone = Column(String)
    # True once the default medication catalogue has been copied into this clinic
    # (so they're clinic-owned and deletable). Prevents re-seeding after deletion.
    default_medications_seeded = Column(Boolean, default=False)
    email = Column(String)
    gst_number = Column(String)
    specialization = Column(String, default='dental')  # dental, cardiology, pathology, etc.
    # plus, pro, growth (and their _annual forms). Never 'free' — that tier was
    # retired in Aug 2026 and only survives as a read alias in plans.LEGACY_ALIASES.
    subscription_plan = Column(String, default=plans.DEFAULT_PLAN)
    status = Column(String, default='active')  # active, suspended, cancelled
    razorpay_customer_id = Column(String, nullable=True)  # Razorpay customer ID
    cashfree_customer_id = Column(String, nullable=True)  # Cashfree customer ID
    logo_url = Column(String)
    invoice_template = Column(String, default='modern_orange')
    primary_color = Column(String, default='#10B981')  # Green default
    # When True, patient WhatsApp buttons open WhatsApp (native app on desktop,
    # one reused web tab) with a prefilled message instead of auto-sending via
    # the MolarPlus/MSG91 number — so the clinic sends from their own number.
    manual_whatsapp = Column(Boolean, default=False)
    # Security contact — a phone + email for account recovery and sensitive
    # actions, each verified via OTP (Control Center → Security). Kept separate
    # from the public phone/email above.
    security_phone = Column(String, nullable=True)
    security_email = Column(String, nullable=True)
    security_phone_verified = Column(Boolean, default=False)
    security_email_verified = Column(Boolean, default=False)
    # Master password — the six digits that stand between a staff member and a
    # delete nothing can undo (a patient, a paid bill, a recorded payment).
    # NULL means the clinic is still on the factory default (123456); that is
    # what the "change this" nudge in Control Center keys off, and it means
    # every clinic that predates this column keeps working without a backfill.
    master_password_hash = Column(String, nullable=True)
    master_password_updated_at = Column(DateTime, nullable=True)
    # Six digits is a million guesses, which is nothing to a script. Failures
    # are counted and the code locks for a while, so grinding it is not on.
    master_password_attempts = Column(Integer, default=0)
    master_password_locked_until = Column(DateTime, nullable=True)
    # Where the practice physically is, and how far from it a staff member may
    # stand and still be "at work". Both null on an unconfigured clinic, and the
    # geofence deliberately lets everybody through in that case: a clinic that
    # has never set its pin should not have its receptionist locked out of
    # clocking in.
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    geofence_radius_m = Column(Integer, default=150)
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
    clinic_label = Column(String, nullable=True)  # e.g. "Main Branch", "Branch"
    parent_clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True)  # set on branch clinics
    country = Column(String(2), default='IN')  # ISO 3166-1 alpha-2
    currency_code = Column(String(3), default='INR')  # ISO 4217
    currency_symbol = Column(String(5), default='₹')
    timezone = Column(String(50), default='Asia/Kolkata')  # IANA timezone
    tax_label = Column(String(20), default='GST No.')  # GST, VAT, TIN, ABN...
    tax_id = Column(String(50), nullable=True)  # replaces gst_number for intl
    # Structured address. `address` above stays the single composed line and is
    # still what invoices, receipts, prescriptions, the website and the mobile
    # app read, so it is kept in sync from these parts on every save rather than
    # being replaced by them. Named generically (not "pincode"/"district")
    # because the app now serves ~160 countries.
    address_line1 = Column(String(200), nullable=True)   # street / building
    address_line2 = Column(String(200), nullable=True)   # area, landmark, suite
    city = Column(String(120), nullable=True)            # city / town
    state = Column(String(120), nullable=True)           # state / province / region
    postal_code = Column(String(20), nullable=True)      # pincode / ZIP / postcode
    # Filled when the address came from Google Places, so the pin on the website
    # and the booking page agrees with what the clinic actually picked.
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    google_place_id = Column(String(255), nullable=True)
    # Practice licence / registration — shown on the Clinic Profile "License" tab.
    license_number = Column(String(80), nullable=True)  # council / clinical establishment reg. no.
    license_authority = Column(String(120), nullable=True)  # issuing body

    # ── Public website ──────────────────────────────────────────────────────
    # The URL handle. clinic_code is CLN-A3X9K2B7FQ, fine as an identifier and
    # useless in a URL a patient might read out, so the site gets its own slug
    # derived from the name and editable by the clinic.
    website_slug = Column(String(80), unique=True, nullable=True, index=True)
    # Nothing is public until the clinic says so. A half-configured clinic
    # should never discover it has been published.
    website_enabled = Column(Boolean, default=False)
    website_published_at = Column(DateTime, nullable=True)
    website_about = Column(Text, nullable=True)        # optional longer intro
    # A patient count on a public page is a number competitors can read, so it
    # is banded ("500+ patients treated") and can be switched off entirely.
    website_show_stats = Column(Boolean, default=True)
    license_expiry = Column(Date, nullable=True)
    # Assigned MolarPlus account manager, shown on Support Center. All nullable:
    # a clinic with no manager assigned shows an empty state, never a placeholder
    # person. Set by the support team, not by the clinic.
    account_manager_name = Column(String(120), nullable=True)
    account_manager_role = Column(String(120), nullable=True)  # e.g. "Customer Success Manager"
    account_manager_email = Column(String(120), nullable=True)
    account_manager_phone = Column(String(20), nullable=True)

    # Relationships
    users = relationship("User", secondary=user_clinics, back_populates="clinics")
    branches = relationship(
        "Clinic",
        foreign_keys=[parent_clinic_id],
        backref=backref("parent_clinic", remote_side="Clinic.id"),
    )

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True)  # Current/Default clinic
    email = Column(String, nullable=True, unique=True)  # Required for owners; staff may have only username
    username = Column(String, nullable=True, unique=True, index=True)  # Login identifier for staff (no email required)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    name = Column(String, nullable=False)  # Full name of the user (computed from first_name + last_name)
    role = Column(String, nullable=False, default='receptionist')  # clinic_owner, doctor, receptionist

    # What this person is paid per case, set once in Staff settings rather than
    # typed on each case paper. Typing it per case is how the same doctor ends
    # up with three different rates and "who earns most" becomes unanswerable —
    # the same failure the free-text lab work_type already shows.
    # NULL basis = not a paid consultant (the owner-dentist, receptionists), and
    # no cost row is created for their work.
    # What a clinician earns per case: a flat fee or a share of what they bill.
    # Distinct from salary below — a visiting consultant may have a fee and no
    # salary, an in-house doctor may have both.
    fee_basis = Column(String, nullable=True)    # fixed | percentage | None
    fee_value = Column(Float, nullable=True)     # rupees, or percent of collection
    # Recurring pay. `salary_day` is the day of the month it is handed over, so
    # the clinic can be told what is due without anybody keeping a mental
    # calendar. Both null for staff who are not on a salary at all, which is the
    # honest default rather than zero — nothing is owed to somebody whose pay
    # has never been recorded.
    salary_amount = Column(Float, nullable=True)
    salary_day = Column(Integer, nullable=True)   # 1-31
    joined_on = Column(Date, nullable=True)       # no salary is due before this
    permissions = Column(JSON, default=dict)
    dashboard_preferences = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    supabase_user_id = Column(String, nullable=True)  # Link to Supabase auth user
    password_hash = Column(String, nullable=True)  # Password hash for OAuth users who want desktop access
    signature_url = Column(Text, nullable=True)  # Base64 signature image for prescriptions/documents
    phone = Column(String, nullable=True)  # Optional personal contact number (profile)
    avatar_url = Column(Text, nullable=True)  # Optional base64 profile photo (profile)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)  # Who created this user
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, default='local')  # 'local', 'synced', 'pending'
    email_report_unsubscribed = Column(Boolean, default=False)  # Opt-out of daily/weekly/monthly email reports
    
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
    date_of_birth = Column(Date, nullable=True)  # Optional; age can be derived from this
    gender = Column(String, nullable=True)
    village = Column(String, nullable=True)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    referred_by = Column(String, nullable=True)
    # Their usual dentist. Pre-selects the doctor on a new case paper so the
    # consultant fee is attributed without anyone typing anything. A default
    # only: whoever actually treated them on the day can override it.
    primary_doctor_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    # Free-text "reason for visit", deliberately not a billable service.
    # Was NOT NULL while PatientCreateDTO, the intake form and every importer
    # all treat it as optional, so any caller that omitted it got a 500 rather
    # than a validation error. The label is optional; the constraint was the
    # anomaly.
    treatment_type = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    patient_history = Column(Text, nullable=True)
    display_id = Column(String, nullable=True, index=True)
    notes = Column(Text)
    payment_type = Column(String, nullable=False, default="Cash")
    # The clinic-local date this patient was registered. Distinct from created_at
    # (a UTC row timestamp): staff can back-date it for a patient first seen
    # earlier, and it is what decides new-vs-repeat in the daily register.
    registered_on = Column(Date, nullable=True, index=True)
    
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
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)  # Linked appointment (if any)
    case_paper_id = Column(Integer, ForeignKey('case_papers.id'), nullable=True)    # Linked case paper / visit
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
    case_paper = relationship("CasePaper")

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
    # The recommendation resolved to a real calendar day. "Review After 1 Month"
    # is not something the front desk can act on; a date is. Null for outcomes
    # that have no date by nature (SOS, no further treatment).
    next_visit_date = Column(Date, nullable=True)
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


class DailyVisit(Base):
    """One row per patient per clinic-local day — the daily register the front
    desk keeps. Deliberately lighter than CasePaper: a walk-in who is registered
    for the day and leaves still belongs here, without creating a clinical record.

    `is_repeat` is stored, not derived on read. It is decided once at registration
    (from the patient's registered_on) so a later correction to a patient's
    registration date can't retroactively rewrite past days' KPIs."""
    __tablename__ = 'daily_visits'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False, index=True)
    visit_date = Column(Date, nullable=False, index=True)  # clinic-local calendar day
    is_repeat = Column(Boolean, nullable=False, default=False)
    doctor_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    reason = Column(String, nullable=True)          # free-text reason for visit
    source = Column(String, nullable=False, default='manual')  # 'manual' | 'check_in'
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # One register entry per patient per day — a walk-in already checked in via
    # the calendar must not be counted twice when staff also add them by hand.
    __table_args__ = (
        UniqueConstraint('clinic_id', 'patient_id', 'visit_date', name='uq_daily_visit_patient_day'),
    )

    clinic = relationship("Clinic")
    patient = relationship("Patient")
    doctor = relationship("User", foreign_keys=[doctor_id])
    creator = relationship("User", foreign_keys=[created_by])
    appointment = relationship("Appointment")


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
    # How long the chair is actually occupied. Without it every booking
    # defaulted to 60 minutes whether it was a check-up or a root canal, and
    # anyone planning a real day did the arithmetic in their head.
    duration_minutes = Column(Integer, nullable=True, default=30)
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
    # Money paid to a member of staff rather than a vendor, which is how a
    # consultant's fee reaches the ledger with a name on it. Without this the
    # ledger could say "Consultant, Rs 2,400" but never which consultant, so a
    # per-consultant split was impossible.
    paid_to_user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
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
    # See domains/scheduling/appointment_status.py for the vocabulary. Do not
    # invent values here: this comment used to claim four statuses that nothing
    # could actually set, while production held four different ones.
    status = Column(String, default='scheduled', index=True)

    # How it ended, and who said so. Recorded only for a terminal status, which
    # is what finally makes a no-show rate computable.
    outcome_at = Column(DateTime, nullable=True)
    outcome_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    cancel_reason = Column(String, nullable=True)

    # Groups the visits of one course of treatment (a root canal is three).
    # Moving or cancelling one must not disturb its siblings, so this is a
    # loose grouping key rather than a parent row.
    series_id = Column(String, nullable=True, index=True)

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
    plan_name = Column(String, nullable=False, default=plans.DEFAULT_PLAN)  # plus, pro, growth (+ _annual)
    status = Column(String, nullable=False, default='active')  # active, paused, cancelled, expired
    current_start = Column(DateTime, nullable=True)  # Current billing period start
    current_end = Column(DateTime, nullable=True)  # Current billing period end
    is_trial = Column(Boolean, default=False)
    trial_ends_at = Column(DateTime, nullable=True)
    trial_used = Column(Boolean, default=False)  # True once a free trial has ever been started (blocks re-trial)
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
    # One promo at a time may be "featured", which surfaces it as a banner on
    # every clinic's Subscription page instead of waiting for somebody to be
    # told the code. Only ever honoured while the coupon is active, unexpired
    # and has redemptions left.
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SubscriptionPayment(Base):
    __tablename__ = 'subscription_payments'
    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey('subscriptions.id'), nullable=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    provider = Column(String, nullable=False)          # cashfree
    provider_order_id = Column(String, nullable=True, index=True)
    provider_payment_id = Column(String, nullable=True, index=True)
    plan_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)             # total charged, tax included
    # The tax inside `amount`, so an invoice can show a GST line instead of one
    # opaque figure. Nullable because every payment taken before this column
    # existed has an unknown split, and guessing one retrospectively would put a
    # number on a tax invoice that nobody actually charged.
    tax_amount = Column(Float, nullable=True)
    # Which promo code produced this payment, and what it took off. Without
    # these a campaign cannot be attributed to revenue and the invoice cannot
    # show the clinic the discount it was given.
    coupon_code = Column(String, nullable=True)
    discount_amount = Column(Float, nullable=True)
    currency = Column(String, default='INR')
    status = Column(String, nullable=False)            # paid, failed, refunded
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subscription = relationship("Subscription", backref="payments")
    clinic = relationship("Clinic")
    user = relationship("User")


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
    case_paper_id = Column(Integer, ForeignKey('case_papers.id'), nullable=True)  # a case paper can carry several invoices
    invoice_number = Column(String, nullable=False, index=True)  # Auto-generated: INV-YYYY-XXXX
    status = Column(String, nullable=False, default='draft')  # draft, finalized, partially_paid, paid_unverified, paid_verified, cancelled
    payment_mode = Column(String, nullable=True)  # UPI, Cash, Card, etc.
    utr = Column(String, nullable=True)  # UTR number for UPI payments
    subtotal = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    discount_type = Column(String, default='amount')  # 'amount' or 'percentage'
    discount_amount = Column(Float, default=0.0)  # The finalized deduction value
    applied_offer_id = Column(Integer, ForeignKey('offers.id'), nullable=True)  # which Offer set this discount (for the label on the bill)
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
    applied_offer = relationship("Offer", foreign_keys=[applied_offer_id])
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    audit_logs = relationship("InvoiceAuditLog", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("InvoicePayment", back_populates="invoice", cascade="all, delete-orphan")
    post_issue_discounts = relationship("InvoiceDiscount", back_populates="invoice", cascade="all, delete-orphan")


class InvoicePayment(Base):
    """One installment against an invoice — the partial-payment history. An
    invoice's paid/due/status are derived from the sum of these rows, so a
    procedure paid in small amounts over time shows each dated payment."""
    __tablename__ = 'invoice_payments'
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey('invoices.id'), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    paid_on = Column(Date, nullable=True)          # date the payment was received
    method = Column(String, nullable=True)         # Cash, UPI, Card, ...
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # ── Receipt for this installment ────────────────────────────────────────
    # The PDF itself is rendered on demand and never stored: rendering is
    # deterministic, so a saved blob would only add storage and a stale copy the
    # moment a later correction moves the invoice total. What must survive is the
    # identity and the arithmetic of the moment the money was taken — a reprint
    # has to carry the same number and the same figures the patient was given.
    receipt_number = Column(String, nullable=True, index=True)   # RCP-YYYY-####
    receipt_paid_to_date = Column(Float, nullable=True)  # total paid incl. this one, frozen
    receipt_balance_due = Column(Float, nullable=True)   # balance right after this one, frozen

    invoice = relationship("Invoice", back_populates="payments")


class InvoiceDiscount(Base):
    """A discount applied to an invoice *after* it was issued (finalized, part-paid
    or paid). Append-only: each concession is its own dated row with a reason and
    the staff member who granted it, so a bill's history is never overwritten.

    Draft invoices keep using Invoice.discount / discount_type — this table is
    only for concessions granted once the bill was already in the patient's hands.
    `amount` is the resolved deduction: a percentage is snapshotted to currency at
    the moment it's applied, so later edits to the line items can't silently
    re-scale a concession that was already agreed with the patient."""
    __tablename__ = 'invoice_discounts'
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey('invoices.id'), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    value = Column(Float, nullable=False, default=0.0)        # as typed by the user
    discount_type = Column(String, nullable=False, default='amount')  # 'amount' | 'percentage'
    amount = Column(Float, nullable=False, default=0.0)       # resolved deduction in currency
    reason = Column(String, nullable=False)
    applied_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    applied_at = Column(DateTime, default=datetime.datetime.utcnow)

    invoice = relationship("Invoice", back_populates="post_issue_discounts")
    user = relationship("User")


class Offer(Base):
    """A reusable, clinic-defined discount offer that staff apply to an invoice
    (whole-invoice). Distinct from InvoiceDiscount (a one-off post-issue
    concession) and from subscription coupons. Applying an offer simply sets the
    invoice's discount + discount_type, so it flows through the normal totals
    math — this table is just the catalogue managed in Control Center → Offers."""
    __tablename__ = 'offers'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True)                       # optional short code
    discount_type = Column(String, nullable=False, default='percentage')  # 'amount' | 'percentage'
    value = Column(Float, nullable=False, default=0.0)         # percent, or flat currency amount
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)
    min_invoice_amount = Column(Float, nullable=True)          # only applies at/above this subtotal
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")


class OtpVerification(Base):
    """Short-lived OTP challenge for verifying a clinic's security phone/email.
    Codes are stored hashed with a short expiry and an attempt cap; the send
    endpoint keeps only one active (unconsumed) row per (clinic, channel, target,
    purpose)."""
    __tablename__ = 'otp_verifications'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    channel = Column(String, nullable=False)      # 'whatsapp' | 'email'
    target = Column(String, nullable=False)        # the phone or email being verified
    # What the code unlocks. Part of the key a send invalidates on, so verifying
    # the recovery phone and changing the master password can be in flight at
    # the same time without one silently consuming the other's code.
    purpose = Column(String, nullable=False, default='contact_verification')
    code_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0)
    consumed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


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

    # Where the person was standing when they clocked in and out.
    #
    # These are read and written by domains/scheduling/routes/attendance_mobile.py,
    # which has referenced them since it was written — the columns were never
    # added, so every call to /attendance-mobile/clock-in returned a 500 with an
    # empty body. The feature existed on paper only.
    #
    # `accuracy` is the device's own error estimate in metres and is stored
    # alongside the fix, because a coordinate without it cannot be judged: 40m
    # from the clinic means nothing if the reading is +/- 100m.
    clock_in_latitude = Column(Float, nullable=True)
    clock_in_longitude = Column(Float, nullable=True)
    clock_in_accuracy = Column(Float, nullable=True)
    clock_in_address = Column(String, nullable=True)
    clock_in_distance_m = Column(Float, nullable=True)   # from the clinic pin, when set
    clock_out_latitude = Column(Float, nullable=True)
    clock_out_longitude = Column(Float, nullable=True)
    clock_out_accuracy = Column(Float, nullable=True)
    clock_out_address = Column(String, nullable=True)
    clock_out_distance_m = Column(Float, nullable=True)

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
    # A precise fix, captured once at enrolment and refreshed on later sign-ins.
    # Kept beside `location` rather than replacing it: the string stays readable
    # when no GPS was available, and a device that never granted the permission
    # still shows the city its IP suggests.
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_accuracy = Column(Float, nullable=True)
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

class DoctorAvailability(Base):
    """When a dentist normally works, one row per weekday block.

    Two rows for one weekday express a split shift (a morning list and an
    evening list with a break between), which is how most practices actually
    run. No row for a weekday means not working that day.

    Clinic opening hours already existed on `Clinic.timings`, but they say when
    the door is open, not who is behind it. Without this the grid would happily
    book a dentist onto a day they are not in the building.
    """
    __tablename__ = 'doctor_availability'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    weekday = Column(Integer, nullable=False)          # 0 = Monday .. 6 = Sunday
    start_time = Column(String, nullable=False)        # "09:00"
    end_time = Column(String, nullable=False)          # "13:00"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    doctor = relationship("User")


class DoctorTimeOff(Base):
    """Leave, a conference, a half day.

    Stored as a date range with optional times so a single afternoon off does
    not require blocking the whole day. Overrides availability rather than
    editing it, so the normal working week survives a week of holiday.
    """
    __tablename__ = 'doctor_time_off'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    # Null on both means the whole day (or range of days) is off.
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    doctor = relationship("User", foreign_keys=[doctor_id])


class AppointmentWaitlist(Base):
    """Patients who want an earlier slot than the one they were given.

    When a cancellation frees a slot, nothing previously knew who wanted it,
    so the gap simply went unused. A waitlist entry is a standing request, not
    a booking: it holds no time and blocks nothing.
    """
    __tablename__ = 'appointment_waitlist'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=True)
    patient_name = Column(String, nullable=False)
    patient_phone = Column(String, nullable=True)
    doctor_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    treatment = Column(String, nullable=True)
    duration = Column(Integer, nullable=False, default=30)
    # The window they would accept. Null means anything.
    preferred_from = Column(Date, nullable=True)
    preferred_to = Column(Date, nullable=True)
    note = Column(String, nullable=True)
    status = Column(String, nullable=False, default='waiting')  # waiting | booked | dropped
    # Set when a waitlist entry turns into a real booking, so the two stay tied.
    booked_appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("Patient")
    doctor = relationship("User", foreign_keys=[doctor_id])


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
    # Visiting consultants are vendors with category='Consultant'. They are paid
    # the same way a staff consultant is, they just have no login, so the fee
    # terms live here too rather than forcing every payee to be a user.
    fee_basis = Column(String, nullable=True)    # fixed | percentage | None
    fee_value = Column(Float, nullable=True)
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
    min_stock_level = Column(Float, default=0.0)  # reorder level (kept internal, not shown as a table column)
    price_per_unit = Column(Float, default=0.0)
    batch_number = Column(String, nullable=True)
    expiry_date = Column(Date, nullable=True)     # consumables expire too; drives the expiry alert
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")
    vendor = relationship("Vendor")

class ConsentTemplate(Base):
    __tablename__ = 'consent_templates'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String, nullable=False)
    # What kind of consent this is. Groups the list so a clinic finds "the
    # extraction one" by shape instead of reading every name.
    category = Column(String, nullable=True)
    content = Column(Text, nullable=False)  # HTML or Markdown with variables
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    clinic = relationship("Clinic")

class PatientConsent(Base):
    __tablename__ = 'patient_consents'
    id = Column(Integer, primary_key=True, index=True)
    # Without this a consent could only be scoped by walking to its patient,
    # which is how the list endpoint ended up returning other clinics' records.
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True, index=True)
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
    invoice_line_item_id = Column(Integer, ForeignKey('invoice_line_items.id'), nullable=True)  # billed line on the case paper's draft, if any

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    clinic = relationship("Clinic")
    patient = relationship("Patient")
    case_paper = relationship("CasePaper")
    vendor = relationship("Vendor")


class ClinicPhoto(Base):
    """A photo of the clinic, for the public website's gallery and hero.

    The one piece of website content the app could not already supply: names,
    hours, treatments, prices, reviews and dentists all exist elsewhere, but
    nothing ever asked a clinic what the place looks like. Uploaded in Control
    Center alongside the logo, stored in R2 under the branding category.
    """
    __tablename__ = 'clinic_photos'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    file_path = Column(String, nullable=False)    # R2 key
    caption = Column(String(120), nullable=True)
    # Lower sorts first. The first photo doubles as the website hero image.
    sort_order = Column(Integer, default=0)
    uploaded_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    clinic = relationship("Clinic")


class CaseCost(Base):
    """What a case cost the clinic: a lab bill, or a consultant's fee.

    One model for both because they are the same shape — an amount owed to an
    outside party for work on a specific patient. Before this, `LabOrder.cost`
    was the only cost recorded anywhere and it never left the Lab module, so
    lab bills never reached the ledger and a clinic's "money out" understated
    reality by whatever it spent on lab work. Consultant fees had nowhere to
    live at all.

    This is strictly the COST side. `LabOrder.cost` is what the lab charges the
    clinic; the invoice line item is what the clinic charges the patient. They
    are different numbers, already linked by `LabOrder.invoice_line_item_id`
    when the cost was passed on. Nothing here ever touches invoice totals, so a
    cost can never change what a patient owes.

    The payee is a `Vendor` for both kinds: labs already are vendors, and a
    consultant is a vendor with `category='Consultant'`. That means settlement
    can reuse `Expense.vendor_id` untouched, and a settled cost shows up in the
    existing ledger with no changes to how the ledger is built.
    """
    __tablename__ = 'case_costs'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False, index=True)
    case_paper_id = Column(Integer, ForeignKey('case_papers.id'), nullable=True)
    # The bill this case produced, when there is one. Used to resolve a
    # percentage fee against what the patient has actually paid.
    invoice_id = Column(Integer, ForeignKey('invoices.id'), nullable=True)
    # Set when this cost was derived from a lab order, so the two stay in step
    # and a re-save updates rather than duplicates.
    lab_order_id = Column(Integer, ForeignKey('lab_orders.id'), nullable=True, index=True)
    vendor_id = Column(Integer, ForeignKey('vendors.id'), nullable=True)
    # Exactly one of vendor_id / doctor_user_id identifies who is owed. Labs and
    # visiting consultants are vendors; staff consultants are users.
    doctor_user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)

    kind = Column(String, nullable=False, default='lab')      # lab | consultant | other
    description = Column(String, nullable=True)

    # 'fixed' is a rupee amount typed in. 'percentage' is a share of what the
    # linked invoice has COLLECTED, resolved into `amount` when it is worked
    # out — a clinic pays a consultant out of money it actually has, and part
    # payment is normal, so billing-based shares would owe money on unpaid work.
    basis = Column(String, nullable=False, default='fixed')   # fixed | percentage
    percentage = Column(Float, nullable=True)
    amount = Column(Float, nullable=False, default=0.0)

    status = Column(String, nullable=False, default='unpaid')  # unpaid | paid
    paid_on = Column(Date, nullable=True)
    # The Expense written when this was settled. Deleting the cost reverses it.
    expense_id = Column(Integer, ForeignKey('expenses.id'), nullable=True)

    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")
    patient = relationship("Patient")
    case_paper = relationship("CasePaper")
    vendor = relationship("Vendor")
    lab_order = relationship("LabOrder")


class MedicationGroup(Base):
    """A named set of prescription lines, so a doctor picks once instead of
    typing the same three drugs after every root canal.

    The clinic's own data is the argument for this: across 18 prescriptions,
    Paracetamol 650mg had been typed 10 times and Candid Mouth Paint 7, and one
    entry read "Amoxicillin 500mq" — a typo baked into a patient's record, which
    is what retyping the same drug every visit eventually produces.

    A group holds LINES, not just drug names. The dosage, duration and quantity
    are most of what gets retyped, so storing only names would leave the work
    where it was.
    """
    __tablename__ = 'medication_groups'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    name = Column(String, nullable=False)              # "Root canal, day 1"
    description = Column(String, nullable=True)
    # Surfaces matching groups first in the picker. Optional: a clinic may have
    # sets that belong to no single treatment.
    treatment_type_id = Column(Integer, ForeignKey('treatment_types.id'), nullable=True)
    # Adult and paediatric doses differ enough that one set cannot serve both.
    # Kept as a plain label rather than an age rule, because a lot of patient
    # records have no age and a rule with nothing to test would quietly hide
    # every set.
    audience = Column(String, nullable=True)           # adult | child | None
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    items = relationship("MedicationGroupItem", back_populates="group",
                         cascade="all, delete-orphan", order_by="MedicationGroupItem.sort_order")
    treatment_type = relationship("TreatmentType")


class MedicationGroupItem(Base):
    """One line of a group: the drug plus how to take it."""
    __tablename__ = 'medication_group_items'
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey('medication_groups.id'), nullable=False, index=True)
    # Linked to stock when it matches something the clinic holds, which is what
    # stops the spelling drifting. Free text stays allowed: clinics prescribe
    # plenty they do not stock, and requiring a link would block the feature on
    # a complete medicine list.
    medication_stock_id = Column(Integer, ForeignKey('medication_stock.id'), nullable=True)
    medicine_name = Column(String, nullable=False)
    dosage = Column(String, nullable=True)             # "1-0-1"
    duration = Column(String, nullable=True)           # "5 days"
    quantity = Column(String, nullable=True)           # "10"
    notes = Column(String, nullable=True)              # "After meals"
    sort_order = Column(Integer, default=0)

    group = relationship("MedicationGroup", back_populates="items")


class MedicationStock(Base):
    """Medication inventory — physical stock of medicines, kept separate from
    general consumables (InventoryItem) and from the prescription Medication
    master. Each row is a stocked medicine with strength/form, batch, expiry and
    quantity; expiry and low-stock drive the in-app alerts."""
    __tablename__ = 'medication_stock'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    vendor_id = Column(Integer, ForeignKey('vendors.id'), nullable=True)
    name = Column(String, nullable=False)          # brand / trade name
    generic_name = Column(String, nullable=True)
    strength = Column(String, nullable=True)       # e.g. "500 mg"
    form = Column(String, nullable=True)           # Tablet, Capsule, Syrup, Injection, ...
    quantity = Column(Float, default=0.0)          # counted in `unit` (the dispensing/base unit)
    unit = Column(String, nullable=True)           # base/dispensing unit: tablet, capsule, ml, ...
    pack_unit = Column(String, nullable=True)      # how it's bought: strip, box, bottle (optional)
    units_per_pack = Column(Float, nullable=True)  # base units per pack, e.g. 10 tablets/strip (optional)
    min_stock_level = Column(Float, default=0.0)   # reorder level (internal), in base units
    price_per_unit = Column(Float, default=0.0)
    batch_number = Column(String, nullable=True)
    expiry_date = Column(Date, nullable=True)
    schedule = Column(String, nullable=True)       # OTC, H, H1 (India Rx schedule)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")
    vendor = relationship("Vendor")


class InventoryTransaction(Base):
    """A single stock movement — the inventory ledger.

    `direction='out'` (usage/wastage) decrements the item's stock; `'in'`
    (restock/received) increments it. Deleting a row reverses its effect.
    Usage recorded from a case paper carries patient_id/case_paper_id; manual
    entries may set patient_id optionally or leave it null (general/wastage).
    item_name/unit are snapshotted so a row stays readable even if the item is
    later renamed or removed."""
    __tablename__ = 'inventory_transactions'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=True)
    case_paper_id = Column(Integer, ForeignKey('case_papers.id'), nullable=True)
    inventory_item_id = Column(Integer, ForeignKey('inventory_items.id'), nullable=True)
    medication_stock_id = Column(Integer, ForeignKey('medication_stock.id'), nullable=True)  # for medication movements
    invoice_line_item_id = Column(Integer, ForeignKey('invoice_line_items.id'), nullable=True)  # billed line, if auto-added to an invoice

    direction = Column(String, nullable=False, default='out')  # 'out' | 'in'
    action = Column(String, nullable=True)        # added | restocked | received | used | deducted | adjusted | removed
    item_name = Column(String, nullable=False)   # snapshot at time of the movement
    quantity = Column(Float, nullable=False, default=0.0)  # always positive
    unit = Column(String, nullable=True)          # snapshot (pcs, ml, ...)
    note = Column(String, nullable=True)          # reason for manual entries

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    clinic = relationship("Clinic")
    patient = relationship("Patient")
    case_paper = relationship("CasePaper")
    inventory_item = relationship("InventoryItem")


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
    provider = Column(String, default='msg91')          # 'msg91' (paid) | 'wareach' (own number, free)
    error_message = Column(Text, nullable=True)
    provider_message_id = Column(String, nullable=True, index=True)  # MSG91 request_id for webhook correlation
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")


class WhatsAppIntegration(Base):
    """Per-clinic 'own number' WhatsApp link via WA Reach (whatsapp-web.js).

    Additive & separate from the MSG91 path: a clinic only routes through its
    own number once it has a row here with status='connected'. Clinics with no
    row fall through to the existing MSG91 flow, unchanged.
    """
    __tablename__ = 'whatsapp_integrations'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, unique=True, index=True)
    provider = Column(String, default='wareach')
    session_id = Column(String, nullable=True)          # WA Reach session id
    api_key_enc = Column(Text, nullable=True)           # WA Reach API key, Fernet-encrypted
    phone_number = Column(String, nullable=True)        # linked number (set once connected)
    status = Column(String, default='disconnected')     # disconnected | connecting | connected | failed
    last_status_at = Column(DateTime, nullable=True)
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


class Notification(Base):
    """The clinic's in-app inbox: one row per recipient per event.

    Deliberately distinct from two neighbours it is easy to confuse with:

    * ``ActivityLog`` is a 10-row FIFO feed for the dashboard's recent-activity
      card, with no read state and constant trimming. The header bell used to
      read it, which is why the bell could never show anything meaningful.
    * ``NotificationLog`` records OUTBOUND patient messages (WhatsApp/email via
      MSG91) with delivery status and cost. Nothing to do with staff at all.

    Fanned out on write: an event aimed at "the owner and the front desk"
    becomes one row per user. That keeps read state a column rather than a join
    table, and the unread badge a single indexed count. A clinic has a handful
    of staff, so the row multiplication is not worth normalising away.
    """
    __tablename__ = 'notifications'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    event_type = Column(String(60), nullable=False, index=True)
    severity = Column(String(10), default='info')      # info | action | critical
    title = Column(String(160), nullable=False)
    body = Column(String(400), nullable=True)
    link = Column(String(255), nullable=True)          # in-app path that acts on it
    # What this is about, so a repeat of the same thing can find and fold into
    # the existing row instead of stacking another one.
    entity_type = Column(String(40), nullable=True)
    entity_id = Column(Integer, nullable=True)
    count = Column(Integer, default=1)                 # "3 new bookings" is one row
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    clinic = relationship("Clinic")
    user = relationship("User")


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


class AuditLog(Base):
    """Who changed what, from where.

    Distinct from ActivityLog, which is a 10-row FIFO feed for the dashboard's
    "recent activity" card and is trimmed constantly. This one is the record you
    consult when money or a patient record went missing: append-only, keeps the
    actor's name as a snapshot (the staff member may since have been deleted),
    and captures the device and IP the action came from.

    Only consequential actions are recorded — deletions, money edits, permission
    and clinic-setting changes. Logging every read would bury the one row that
    matters.
    """
    __tablename__ = 'audit_logs'
    id = Column(Integer, primary_key=True, index=True)
    # Nullable because the audit trail starts before the clinic does: a brand
    # new owner signs in, and only then onboards and creates one. NOT NULL here
    # meant every pre-onboarding sign-in tried to write an illegal row. Reads
    # are all scoped `WHERE clinic_id = :clinic`, so a clinic-less row is simply
    # invisible to clinic views rather than leaking into the wrong one.
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True, index=True)

    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    # Snapshotted, not joined: a deleted staff member must not erase the record
    # of what they did.
    actor_name = Column(String, nullable=True)
    actor_role = Column(String, nullable=True)

    action = Column(String, nullable=False, index=True)   # e.g. 'patient.deleted'
    summary = Column(String, nullable=False)              # human-readable line
    entity_type = Column(String, nullable=True)           # 'patient' | 'invoice' | ...
    entity_id = Column(Integer, nullable=True)

    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    clinic = relationship("Clinic")
    user = relationship("User")


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


class FeatureRequest(Base):
    __tablename__ = 'feature_requests'
    id = Column(Integer, primary_key=True, index=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default='open')   # open / planned / in_progress / shipped / declined
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    creator = relationship("User")
    clinic = relationship("Clinic")
    votes = relationship("FeatureRequestVote", back_populates="request", cascade="all, delete-orphan")


class FeatureRequestVote(Base):
    __tablename__ = 'feature_request_votes'
    id = Column(Integer, primary_key=True, index=True)
    feature_request_id = Column(Integer, ForeignKey('feature_requests.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (UniqueConstraint('feature_request_id', 'user_id', name='uq_feature_vote'),)

    request = relationship("FeatureRequest", back_populates="votes")
    user = relationship("User")


class PushToken(Base):
    __tablename__ = 'push_tokens'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True, index=True)
    token = Column(String, nullable=False, unique=True)
    platform = Column(String, nullable=False)  # 'ios' | 'android'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User")
    clinic = relationship("Clinic")


class AppVersion(Base):
    """The floor and the ceiling for each mobile platform.

    One row per platform, edited in place. It lives in the database rather than
    in the source so the floor can be raised the moment a bad build is found —
    a psql UPDATE, effective on every app's next launch, with no backend deploy
    and no app-store release. That speed is the entire point: by the time a
    forced update matters, waiting on a deploy pipeline is already too slow.

    `min_supported` is a hard stop; `latest` is a nudge. Both are semver
    strings compared numerically, never as text, so 3.9.0 sorts below 3.10.0.
    """
    __tablename__ = 'app_versions'
    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String, nullable=False, unique=True, index=True)  # 'ios' | 'android'
    # Below this, the app refuses to run and shows a modal that cannot be closed.
    min_supported = Column(String, nullable=False, default='0.0.0')
    # The newest build in the store. Below it, a dismissible nudge.
    latest = Column(String, nullable=False, default='0.0.0')
    # Optional sentence shown in the modal, e.g. why this update matters.
    message = Column(String, nullable=True)
    store_url = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
