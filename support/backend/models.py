import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Float, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Clinic(Base):
    __tablename__ = 'clinics'
    id = Column(Integer, primary_key=True)
    clinic_code = Column(String)
    name = Column(String)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    gst_number = Column(String)
    specialization = Column(String)
    subscription_plan = Column(String)
    status = Column(String)
    razorpay_customer_id = Column(String, nullable=True)
    cashfree_customer_id = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    invoice_template = Column(String, nullable=True)
    primary_color = Column(String, nullable=True)
    number_of_chairs = Column(Integer, nullable=True)
    timings = Column(JSON, nullable=True)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    synced_at = Column(DateTime, nullable=True)
    sync_status = Column(String, nullable=True)
    referred_by_code = Column(String, nullable=True)


class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True)
    email = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    name = Column(String)
    role = Column(String)
    password_hash = Column(String, nullable=True)
    is_active = Column(Boolean)
    created_at = Column(DateTime)

    active_clinic = relationship("Clinic", foreign_keys=[clinic_id])


class UserDevice(Base):
    __tablename__ = 'user_devices'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    device_name = Column(String)
    device_type = Column(String)
    device_platform = Column(String)
    device_os = Column(String)
    device_serial = Column(String)
    user_agent = Column(Text)
    ip_address = Column(String)
    location = Column(String)
    is_active = Column(Boolean)
    is_online = Column(Boolean)
    last_seen = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    user = relationship("User")


class Patient(Base):
    __tablename__ = 'patients'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    name = Column(String)
    phone = Column(String)
    created_at = Column(DateTime)


class Appointment(Base):
    __tablename__ = 'appointments'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    patient_name = Column(String)
    status = Column(String)
    appointment_date = Column(DateTime)
    created_at = Column(DateTime)


class Invoice(Base):
    __tablename__ = 'invoices'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    invoice_number = Column(String)
    status = Column(String)
    payment_mode = Column(String)
    subtotal = Column(Float)
    tax = Column(Float)
    discount_amount = Column(Float)
    total = Column(Float)
    paid_amount = Column(Float)
    due_amount = Column(Float)
    created_at = Column(DateTime)
    paid_at = Column(DateTime)
    finalized_at = Column(DateTime)

    clinic = relationship("Clinic")
    line_items = relationship("InvoiceLineItem", back_populates="invoice")


class InvoiceLineItem(Base):
    __tablename__ = 'invoice_line_items'
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey('invoices.id'), nullable=False)
    description = Column(String)
    quantity = Column(Float)
    unit_price = Column(Float)
    amount = Column(Float)
    created_at = Column(DateTime)

    invoice = relationship("Invoice", back_populates="line_items")


class Subscription(Base):
    __tablename__ = 'subscriptions'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    plan_name = Column(String)
    status = Column(String)
    provider = Column(String)
    provider_subscription_id = Column(String)
    provider_order_id = Column(String)
    current_start = Column(DateTime)
    current_end = Column(DateTime)
    quantity = Column(Integer)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    clinic = relationship("Clinic")


class SubscriptionCoupon(Base):
    __tablename__ = 'subscription_coupons'
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, index=True, nullable=False)
    discount_percent = Column(Float, nullable=True)  
    discount_amount = Column(Float, nullable=True)   
    is_active = Column(Boolean, default=True)
    expiry_date = Column(DateTime, nullable=True)
    usage_limit = Column(Integer, default=100)
    used_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ReferralCode(Base):
    __tablename__ = 'referral_codes'
    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, index=True, nullable=False)
    creator_name = Column(String, nullable=False)  
    discount_percent = Column(Float, nullable=True)  
    reward_details = Column(JSON, nullable=True)  
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class NotificationLog(Base):
    __tablename__ = 'notification_logs'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    channel = Column(String)
    recipient = Column(String)
    event_type = Column(String)
    template_name = Column(String)
    status = Column(String)
    cost = Column(Float)
    error_message = Column(Text)
    provider_message_id = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime)

    clinic = relationship("Clinic")


class NotificationWallet(Base):
    __tablename__ = 'notification_wallets'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    balance = Column(Float)
    last_topup_at = Column(DateTime)
    created_at = Column(DateTime)

    clinic = relationship("Clinic")


class WalletTransaction(Base):
    __tablename__ = 'wallet_transactions'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    amount = Column(Float)
    transaction_type = Column(String)
    description = Column(String)
    order_id = Column(String)
    status = Column(String)
    created_at = Column(DateTime)

    clinic = relationship("Clinic")


class NotificationPreference(Base):
    __tablename__ = 'notification_preferences'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    event_type = Column(String)
    channel = Column(String, nullable=True)
    channels = Column(JSON, default=list)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    clinic = relationship("Clinic")


class ActivityLog(Base):
    __tablename__ = 'activity_logs'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    event_type = Column(String)
    description = Column(String)
    link = Column(String)
    actor_name = Column(String)
    created_at = Column(DateTime)

    clinic = relationship("Clinic")


class GoogleReview(Base):
    __tablename__ = 'google_reviews'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    place_id = Column(String)
    author_name = Column(String)
    rating = Column(Integer)
    text = Column(Text)
    review_time = Column(DateTime)
    synced_at = Column(DateTime)

    clinic = relationship("Clinic")


class GooglePlaceLink(Base):
    __tablename__ = 'google_place_links'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    place_id = Column(String)
    place_name = Column(String)
    current_rating = Column(Float)
    total_review_count = Column(Integer)
    last_synced_at = Column(DateTime)


class SupportTicket(Base):
    __tablename__ = 'support_tickets'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    assigned_to = Column(Integer, ForeignKey('users.id'), nullable=True)
    title = Column(String)
    description = Column(Text)
    category = Column(String, default='other')
    status = Column(String, default='open')
    priority = Column(String, default='normal')
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

    clinic = relationship("Clinic")
    creator = relationship("User", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assigned_to])
    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan")


class SupportMessage(Base):
    __tablename__ = 'support_messages'
    id = Column(Integer, primary_key=True)
    ticket_id = Column(Integer, ForeignKey('support_tickets.id'), nullable=False)
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    body = Column(Text)
    is_staff = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    ticket = relationship("SupportTicket", back_populates="messages")
    sender = relationship("User")


class GrowthLead(Base):
    __tablename__ = 'growth_leads'
    id = Column(Integer, primary_key=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=True)
    lead_name = Column(String)
    contact_person = Column(String)
    phone = Column(String)
    email = Column(String)
    source = Column(String)
    stage = Column(String)
    owner = Column(String)
    priority = Column(String)
    expected_mrr = Column(Float)
    trial_start = Column(DateTime)
    trial_end = Column(DateTime)
    next_follow_up_at = Column(DateTime)
    last_contact_at = Column(DateTime)
    lost_reason = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    clinic = relationship("Clinic")


class GrowthLeadActivity(Base):
    __tablename__ = 'growth_lead_activities'
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey('growth_leads.id'), nullable=False)
    activity_type = Column(String)
    title = Column(String)
    details = Column(Text)
    by_user = Column(String)
    from_stage = Column(String)
    to_stage = Column(String)
    outcome = Column(String)
    created_at = Column(DateTime)

    lead = relationship("GrowthLead")
