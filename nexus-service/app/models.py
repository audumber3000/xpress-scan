from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Clinic(Base):
    __tablename__ = 'clinics'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    logo_url = Column(String)
    primary_color = Column(String)

class ConsentTemplate(Base):
    __tablename__ = "consent_templates"
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, index=True)
    name = Column(String(255))
    content = Column(Text)
    is_active = Column(Boolean, default=True) # Changed from Integer to Boolean
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PatientConsent(Base):
    __tablename__ = "patient_consents"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, index=True)
    template_id = Column(Integer, ForeignKey("consent_templates.id"))
    signed_content = Column(Text)
    signature_url = Column(String, nullable=True) # Name matches DB, was Text before
    signed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow) # Added to match DB, removed file_path

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    name = Column(String)
    role = Column(String)

class Patient(Base):
    __tablename__ = 'patients'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'))
    name = Column(String, nullable=False)
    gender = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Appointment(Base):
    __tablename__ = 'appointments'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'))
    patient_id = Column(Integer, ForeignKey('patients.id'))
    appointment_date = Column(DateTime)
    status = Column(String)
    doctor_id = Column(Integer, ForeignKey('users.id'))

class Payment(Base):
    __tablename__ = 'payments'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'))
    amount = Column(Float)
    payment_method = Column(String)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Invoice(Base):
    __tablename__ = 'invoices'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'))
    total = Column(Float)
    status = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow)

class Expense(Base):
    __tablename__ = 'expenses'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'))
    amount = Column(Float)
    category = Column(String)
    date = Column(DateTime)

class PatientDocument(Base):
    __tablename__ = 'patient_documents'
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    case_paper_id = Column(Integer, nullable=True)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    file_type = Column(String)
    uploaded_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TemplateConfiguration(Base):
    __tablename__ = 'template_configurations'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'), nullable=False)
    category = Column(String, nullable=False)
    template_id = Column(String, nullable=False, default='default')
    logo_url = Column(String, nullable=True)
    footer_text = Column(Text, nullable=True)
    primary_color = Column(String, nullable=True)
    secondary_color = Column(String, nullable=True)
    config_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DashboardReport(Base):
    __tablename__ = 'dashboard_reports'
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey('clinics.id'))
    report_type = Column(String)
    report_category = Column(String)
    title = Column(String)
    status = Column(String)
    file_url = Column(String)
    parameters = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
