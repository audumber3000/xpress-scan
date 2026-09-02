from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, date

# Clinic Schemas
class ClinicBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    specialization: str = "dental"
    subscription_plan: str = "plus"
    status: str = "active"
    logo_url: Optional[str] = None
    invoice_template: str = "modern_orange"
    primary_color: str = "#10B981"
    timings: Optional[Dict[str, Any]] = {
        'monday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'tuesday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'wednesday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'thursday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'friday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'saturday': {'open': '08:00', 'close': '20:00', 'closed': False},
        'sunday': {'open': '08:00', 'close': '20:00', 'closed': True}
    }

class ClinicCreate(ClinicBase):
    pass

class ClinicOut(ClinicBase):
    id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    email: Optional[str] = None  # Required for owners; staff may have only a username
    username: Optional[str] = None  # Login identifier for staff
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "receptionist"  # clinic_owner, doctor, receptionist
    permissions: Optional[Dict[str, Any]] = {}

class UserCreate(UserBase):
    clinic_id: Optional[int] = None
    created_by: Optional[int] = None

class UserOut(UserBase):
    id: int
    clinic_id: Optional[int] = None
    created_by: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    supabase_user_id: Optional[str] = None
    clinics: List[ClinicOut] = []

    class Config:
        from_attributes = True

# Patient Schemas
class PatientBase(BaseModel):
    name: str
    age: int
    gender: str
    village: Optional[str] = None
    phone: str
    referred_by: Optional[str] = None
    treatment_type: str
    blood_group: Optional[str] = None
    patient_history: Optional[str] = None
    display_id: Optional[str] = None
    last_visit: Optional[datetime] = None
    notes: Optional[str] = None
    payment_type: str = "Cash"
    registered_on: Optional[date] = None

    # Dental specific data
    dental_chart: Optional[Dict[str, Any]] = None
    tooth_notes: Optional[Dict[str, Any]] = None
    treatment_plan: Optional[List[Any]] = None
    prescriptions: Optional[List[Any]] = None

class PatientCreate(PatientBase):
    clinic_id: Optional[int] = None

class PatientOut(PatientBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    class Config:
        from_attributes = True

class PatientResponse(PatientBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    class Config:
        from_attributes = True 

# Treatment Type Schemas
class TreatmentTypeBase(BaseModel):
    name: str
    price: float
    is_active: bool = True

class TreatmentTypeCreate(TreatmentTypeBase):
    clinic_id: Optional[int] = None

class TreatmentTypeUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None

class TreatmentTypeOut(TreatmentTypeBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True 

# Referring Doctor Schemas
class ReferringDoctorBase(BaseModel):
    name: str
    hospital: Optional[str] = None
    is_active: bool = True

class ReferringDoctorCreate(ReferringDoctorBase):
    clinic_id: Optional[int] = None

class ReferringDoctorUpdate(BaseModel):
    name: Optional[str] = None
    hospital: Optional[str] = None
    is_active: Optional[bool] = None

class ReferringDoctorOut(ReferringDoctorBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    class Config:
        from_attributes = True 

# Payment Schemas
class PaymentBase(BaseModel):
    patient_id: int
    report_id: Optional[int] = None
    treatment_type_id: Optional[int] = None
    amount: float
    payment_method: str
    status: str = "success"  # Default to success for new payments
    transaction_id: Optional[str] = None
    notes: Optional[str] = None
    paid_by: Optional[str] = None
    received_by: Optional[int] = None

class PaymentCreate(PaymentBase):
    clinic_id: Optional[int] = None

class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    status: Optional[str] = None
    transaction_id: Optional[str] = None
    notes: Optional[str] = None
    paid_by: Optional[str] = None
    received_by: Optional[int] = None

class PaymentOut(PaymentBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    # Nested patient info for frontend display
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_email: Optional[str] = None
    
    # Nested treatment type info
    treatment_type_name: Optional[str] = None
    
    # Nested received by user info  
    received_by_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Invoice Schemas
class InvoiceLineItemBase(BaseModel):
    description: str
    # Which tooth or region this line bills for. Optional: a scaling covers the
    # whole mouth and a consultation covers none.
    tooth_number: Optional[str] = None
    quantity: float = 1.0
    unit_price: float
    amount: Optional[float] = None  # Will be calculated as quantity * unit_price

class InvoiceLineItemCreate(InvoiceLineItemBase):
    medication_stock_id: Optional[int] = None  # when set, deduct this from medication stock

class ProcedureChargeCreate(BaseModel):
    """A completed procedure auto-billed to its case paper's draft invoice."""
    patient_id: int
    case_paper_id: int
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0

class InvoiceLineItemOut(InvoiceLineItemBase):
    id: int
    invoice_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    # True when a case-paper stock/medication usage record points at this line,
    # so the invoice editor can offer "remove from bill only" vs "restock too".
    linked_stock: bool = False

    class Config:
        from_attributes = True

class InvoiceBase(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    case_paper_id: Optional[int] = None
    payment_mode: Optional[str] = None
    utr: Optional[str] = None
    notes: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceUpdate(BaseModel):
    payment_mode: Optional[str] = None
    utr: Optional[str] = None
    notes: Optional[str] = None
    discount: Optional[float] = None
    discount_type: Optional[str] = None

class InvoiceOut(InvoiceBase):
    id: int
    clinic_id: int
    invoice_number: str
    status: str  # draft, paid_unverified, paid_verified, cancelled
    subtotal: float
    tax: float
    discount: float = 0.0
    discount_type: str = "amount"
    discount_amount: float = 0.0
    total: float
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    paid_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None
    paid_amount: float = 0.0
    due_amount: float = 0.0
    
    # Nested patient info
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    # One free-text line. Undeclared fields are dropped by the response model, so
    # the serialiser emitting this is not enough on its own.
    patient_address: Optional[str] = None
    patient_display_id: Optional[str] = None
    
    # Line items
    line_items: List[InvoiceLineItemOut] = []

    # Itemised partial-payment history
    payments: List["InvoicePaymentOut"] = []

    # Concessions granted after the invoice was issued. `discount_amount` above
    # already includes these; this is the dated, attributed breakdown.
    post_issue_discounts: List["InvoiceDiscountOut"] = []
    post_issue_discount_total: float = 0.0

    class Config:
        from_attributes = True


class InvoiceDiscountOut(BaseModel):
    id: int
    value: float
    discount_type: str = "amount"
    amount: float
    reason: str
    applied_by_name: Optional[str] = None
    applied_at: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceDiscountCreate(BaseModel):
    value: float
    discount_type: str = "amount"  # 'amount' | 'percentage'
    reason: str


class InvoicePaymentOut(BaseModel):
    id: int
    invoice_id: int
    amount: float
    paid_on: Optional[str] = None
    # The clinic-local day this was entered, and whether that came after the day
    # the money actually changed hands.
    recorded_on: Optional[str] = None
    is_back_dated: bool = False
    method: Optional[str] = None
    # The transaction this instalment arrived on, and who took it. Resolved to a
    # name by the route, the way case papers resolve dentist_name — a bare user
    # id tells the timeline nothing.
    reference: Optional[str] = None
    recorded_by: Optional[int] = None
    recorded_by_name: Optional[str] = None
    note: Optional[str] = None
    created_at: Optional[datetime] = None
    # This installment's receipt: the number the patient quotes back, and the two
    # running figures frozen when the money was taken. The PDF is rendered on
    # demand from these, at /invoices/{id}/payments/{payment_id}/receipt.
    receipt_number: Optional[str] = None
    receipt_paid_to_date: Optional[float] = None
    receipt_balance_due: Optional[float] = None

    class Config:
        from_attributes = True

class MarkAsPaidRequest(BaseModel):
    payment_mode: str  # UPI, Cash, Card, etc.
    utr: Optional[str] = None  # also stored as the payment's reference
    is_partial: Optional[bool] = False
    amount_paid: Optional[float] = None
    # The day the money was actually received (YYYY-MM-DD). Defaults to the
    # clinic's today; an earlier date records cash taken before it was entered.
    paid_on: Optional[str] = None
    note: Optional[str] = None

# A single installment recorded against an invoice.
class InvoicePaymentCreate(BaseModel):
    amount: float
    paid_on: Optional[str] = None   # YYYY-MM-DD; defaults to today
    method: Optional[str] = None    # Cash, UPI, Card, ...
    reference: Optional[str] = None # UPI ref, card auth code, cheque number
    note: Optional[str] = None

# X-ray Image Schemas
class XrayImageCreate(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    image_type: str  # 'bitewing', 'panoramic', 'periapical', 'occlusal', 'ceph', etc.
    notes: Optional[str] = None
    brightness: Optional[float] = None
    contrast: Optional[float] = None

class XrayImageOut(BaseModel):
    id: int
    patient_id: int
    appointment_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: int
    image_type: str
    # Which tooth or region the film covers. Nullable: every row predating the
    # column has none, and an OPG legitimately never gets one.
    tooth_area: Optional[str] = None
    capture_date: datetime
    brightness: Optional[float] = None
    contrast: Optional[float] = None
    notes: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    # Nested patient info
    patient_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Report Schemas
class ReportResponse(BaseModel):
    id: Optional[int] = None
    clinic_id: int
    # Whose report this is. Absent until now, so the only way to attribute one
    # was to match on patient_name — which breaks on two patients of the same
    # name, and is exactly what the patient file's Documents tab needs.
    patient_id: Optional[int] = None
    patient_name: str
    # Optional, all four. A report describes a patient who already exists, and
    # plenty of them have no age, gender or referrer on file. Requiring them
    # here made the row unserialisable, and the builder's per-row `except`
    # turned that into a silently missing report rather than an error.
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    treatment_type: Optional[str] = None
    referred_by: Optional[str] = None
    docx_url: Optional[str] = None
    pdf_url: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True

# Subscription Schemas
class SubscriptionBase(BaseModel):
    plan_name: str
    status: str = "active"

class SubscriptionOut(SubscriptionBase):
    id: int
    clinic_id: Optional[int] = None
    user_id: Optional[int] = None
    razorpay_subscription_id: Optional[str] = None
    razorpay_customer_id: Optional[str] = None
    razorpay_plan_id: Optional[str] = None
    
    # Generic Provider Fields
    provider: str = "razorpay"
    provider_subscription_id: Optional[str] = None
    provider_customer_id: Optional[str] = None
    provider_plan_id: Optional[str] = None
    provider_order_id: Optional[str] = None
    
    current_start: Optional[datetime] = None
    current_end: Optional[datetime] = None
    is_trial: bool = False
    trial_ends_at: Optional[datetime] = None
    trial_available: bool = True

    # These three are computed by the route, not columns.
    #
    # is_expired and trial_days_remaining were being returned by
    # get_current_subscription and silently dropped here: a response_model only
    # emits fields it declares. The Subscription page reads both
    # (`subscription?.is_expired === true`, and the "N days left" badge), so
    # until now the badge never appeared and an expired plan never read as
    # expired anywhere in the UI.
    is_expired: bool = False
    trial_days_remaining: Optional[int] = None
    plan_label: Optional[str] = None
    # What the clinic can use RIGHT NOW. Differs from plan_name once a plan has
    # lapsed: plan_name records what they last had, this records what they have.
    effective_plan: Optional[str] = None
    effective_plan_label: Optional[str] = None
    plan_state: Optional[str] = None
    plan_state_blocks: bool = False
    quantity: int = 1
    notes: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True

class SubscriptionCreate(BaseModel):
    plan_name: str  # professional, enterprise
    razorpay_plan_id: Optional[str] = None
    provider: str = "cashfree"

class SubscriptionUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[Dict[str, Any]] = None

class CouponValidateRequest(BaseModel):
    code: str
    plan_name: str

class CouponValidateResponse(BaseModel):
    is_valid: bool
    discount_amount: float
    final_amount: float
    message: Optional[str] = None

class CheckoutRequest(BaseModel):
    # Required. This used to default to "professional", which meant a client
    # that forgot the field silently bought the middle plan.
    plan_name: str
    coupon_code: Optional[str] = None

# Attendance Schemas
class AttendanceBase(BaseModel):
    user_id: int
    date: datetime
    status: str  # on_time, late, absent, holiday
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class AttendanceOut(AttendanceBase):
    id: int
    clinic_id: int
    marked_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    # Where the shift was started and ended. `distance_m` is the number an owner
    # actually reads — "412 m away" says something a raw coordinate pair does
    # not — and is null when the clinic has never dropped its pin.
    clock_in_latitude: Optional[float] = None
    clock_in_longitude: Optional[float] = None
    clock_in_accuracy: Optional[float] = None
    clock_in_address: Optional[str] = None
    clock_in_distance_m: Optional[float] = None
    clock_out_latitude: Optional[float] = None
    clock_out_longitude: Optional[float] = None
    clock_out_accuracy: Optional[float] = None
    clock_out_address: Optional[str] = None
    clock_out_distance_m: Optional[float] = None
    
    class Config:
        from_attributes = True

# Message Template Schemas
class MessageTemplateBase(BaseModel):
    name: str  # e.g., "welcome", "invoice"
    title: str  # Display name
    content: str  # Template content
    variables: Optional[List[str]] = []  # Available variables
    is_active: bool = True

class MessageTemplateCreate(MessageTemplateBase):
    clinic_id: Optional[int] = None

class MessageTemplateUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: Optional[bool] = None

class MessageTemplateOut(MessageTemplateBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    
    class Config:
        from_attributes = True 

# Vendor Schemas
class VendorBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: bool = True

class VendorCreate(VendorBase):
    clinic_id: Optional[int] = None

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: Optional[bool] = None

class VendorOut(VendorBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Inventory Item Schemas
class InventoryItemBase(BaseModel):
    name: str
    category: Optional[str] = None
    quantity: float = 0.0
    unit: Optional[str] = None
    min_stock_level: float = 0.0
    price_per_unit: float = 0.0

class InventoryItemCreate(InventoryItemBase):
    clinic_id: Optional[int] = None
    vendor_id: Optional[int] = None

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    min_stock_level: Optional[float] = None
    price_per_unit: Optional[float] = None
    vendor_id: Optional[int] = None

class InventoryItemOut(InventoryItemBase):
    id: int
    clinic_id: int
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Consent Template Schemas
class ConsentTemplateBase(BaseModel):
    name: str
    content: str
    is_active: bool = True

class ConsentTemplateCreate(ConsentTemplateBase):
    clinic_id: Optional[int] = None

class ConsentTemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    is_active: Optional[bool] = None

class ConsentTemplateOut(ConsentTemplateBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Patient Consent Schemas
class PatientConsentBase(BaseModel):
    patient_id: int
    template_id: int
    signed_content: str
    signature_url: Optional[str] = None

class PatientConsentCreate(PatientConsentBase):
    pass

class PatientConsentOut(PatientConsentBase):
    id: int
    signed_at: Optional[datetime] = None
    created_at: datetime
    template_name: Optional[str] = None

    class Config:
        from_attributes = True

# Patient Document Schemas
class PatientDocumentBase(BaseModel):
    patient_id: int
    file_name: str
    file_type: str
    file_size: Optional[int] = None

class PatientDocumentCreate(PatientDocumentBase):
    clinic_id: Optional[int] = None

class PatientDocumentOut(PatientDocumentBase):
    id: int
    clinic_id: int
    file_path: str
    uploaded_by: Optional[int] = None
    uploader_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    clinic_id: Optional[int] = None # For switching clinic
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    name: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None

# Expense Schemas
class ExpenseBase(BaseModel):
    vendor_id: Optional[int] = None
    amount: float
    payment_method: str
    category: str = "General"
    notes: Optional[str] = None
    date: Optional[datetime] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    vendor_id: Optional[int] = None
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[datetime] = None

class ExpenseOut(ExpenseBase):
    id: int
    clinic_id: int
    bill_file_url: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    vendor_name: Optional[str] = None
    creator_name: Optional[str] = None

    class Config:
        from_attributes = True

# Ledger Item Schema (Unifies Invoice and Expense for the frontend)
class LedgerItemOut(BaseModel):
    id: int
    type: str  # 'invoice' or 'expense'
    date: datetime
    amount: float
    payment_method: Optional[str] = None
    category: str
    description: str
    entity_name: Optional[str] = None  # Patient name or Vendor name
    entity_id: Optional[int] = None
    status: Optional[str] = None
    bill_file_url: Optional[str] = None # for expenses
    invoice_number: Optional[str] = None # for invoices
    invoice_id: Optional[int] = None # invoice this income row belongs to (for opening it)
    recorded_at: Optional[datetime] = None # real timestamp (with time) for display; date field may be a pure day
    
    class Config:
        from_attributes = True

# Clinical Setting Schemas
class ClinicalSettingBase(BaseModel):
    category: str  # complaint, finding, diagnosis, medical-condition
    name: str
    description: Optional[str] = None
    is_active: bool = True

class ClinicalSettingCreate(ClinicalSettingBase):
    clinic_id: Optional[int] = None

class ClinicalSettingUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ClinicalSettingOut(ClinicalSettingBase):
    id: int
    clinic_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Case Paper Schemas
class CasePaperBase(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    dentist_id: Optional[int] = None
    date: datetime
    status: str = "In Progress"
    chief_complaint: Optional[Any] = []
    medical_history: Optional[Any] = []
    allergies: Optional[Any] = []
    dental_history: Optional[Any] = []
    clinical_examination: Optional[str] = None
    diagnosis: Optional[str] = None
    next_visit_recommendation: Optional[str] = None
    next_visit_date: Optional[date] = None
    notes: Optional[str] = None
    
    # Clinical Snapshots
    dental_chart_snapshot: Optional[Any] = None
    treatment_plan_snapshot: Optional[Any] = None
    tooth_notes_snapshot: Optional[Any] = None
    # The dermatology case paper's findings. Null on a dental paper.
    derm_findings: Optional[Any] = None

class CasePaperCreate(CasePaperBase):
    clinic_id: Optional[int] = None

class CasePaperUpdate(BaseModel):
    status: Optional[str] = None
    chief_complaint: Optional[Any] = None
    medical_history: Optional[Any] = None
    allergies: Optional[Any] = None
    dental_history: Optional[Any] = None
    clinical_examination: Optional[str] = None
    diagnosis: Optional[str] = None
    next_visit_recommendation: Optional[str] = None
    next_visit_date: Optional[date] = None
    notes: Optional[str] = None
    dental_chart_snapshot: Optional[Any] = None
    treatment_plan_snapshot: Optional[Any] = None
    tooth_notes_snapshot: Optional[Any] = None
    derm_findings: Optional[Any] = None

import json as _json

def _parse_json_list(v):
    """Safely coerce a DB-stored JSON string back to a Python list."""
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        try:
            parsed = _json.loads(v)
            return parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            return [v] if v.strip() else []
    if v is None:
        return []
    return v

def _parse_json_auto(v, default=None):
    """Safely parse JSON and preserve its structure (Dict/List), returning default if None."""
    if v is None:
        return default
    if isinstance(v, (dict, list)):
        return v
    if isinstance(v, str):
        try:
            return _json.loads(v)
        except Exception:
            return default
    return v

class CasePaperOut(CasePaperBase):
    id: int
    clinic_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    # Who saw them, by name. dentist_id was already stored and returned, but a
    # bare id tells the list nothing, so every card read "Not assigned" even
    # when the visit plainly had a dentist. The name comes off the existing
    # relationship rather than a second request per card.
    dentist_name: Optional[str] = None

    @classmethod
    def model_validate(cls, obj, **kwargs):
        if hasattr(obj, '__dict__') or hasattr(obj, '_sa_instance_state'):
            data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}

            # dentist_name is set by the route, not derived here: FastAPI reads
            # attributes directly off the ORM object for response_model, so this
            # classmethod is not called on the serialisation path.
            data['dentist_name'] = getattr(obj, 'dentist_name', None)
            
            # Legacy list-like fields
            for field in ('chief_complaint', 'medical_history', 'allergies', 'dental_history'):
                data[field] = _parse_json_list(data.get(field))
            
            # Snapshots with specific defaults
            data['dental_chart_snapshot'] = _parse_json_auto(data.get('dental_chart_snapshot'), {})
            data['tooth_notes_snapshot'] = _parse_json_auto(data.get('tooth_notes_snapshot'), {})
            data['treatment_plan_snapshot'] = _parse_json_auto(data.get('treatment_plan_snapshot'), [])
            
            return super().model_validate(data, **kwargs)
        return super().model_validate(obj, **kwargs)

    class Config:
        from_attributes = True

# Prescription Schemas
class PrescriptionItem(BaseModel):
    medicine_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    quantity: Optional[str] = None
    instructions: Optional[str] = None
    notes: Optional[str] = None

class PrescriptionBase(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    case_paper_id: Optional[int] = None
    visit_number: Optional[int] = None
    items: List[PrescriptionItem] = []
    notes: Optional[str] = None

class PrescriptionCreate(PrescriptionBase):
    clinic_id: Optional[int] = None

class PrescriptionOut(PrescriptionBase):
    id: int
    clinic_id: int
    pdf_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Lab Order Schemas
class LabOrderBase(BaseModel):
    patient_id: int
    case_paper_id: Optional[int] = None
    vendor_id: int
    work_type: str
    tooth_number: Optional[str] = None
    shade: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str = "Draft"
    cost: float = 0.0

class LabOrderCreate(LabOrderBase):
    clinic_id: Optional[int] = None
    # Off by default: a lab order is only added to the case paper's bill when the
    # user explicitly ticks "add to billing".
    add_to_billing: bool = False

class LabOrderUpdate(BaseModel):
    vendor_id: Optional[int] = None
    work_type: Optional[str] = None
    tooth_number: Optional[str] = None
    shade: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None
    cost: Optional[float] = None
    # None = leave billing as-is; True = bill it (or update the line); False =
    # remove it from the bill (only possible while the invoice is a draft).
    add_to_billing: Optional[bool] = None

class LabOrderOut(LabOrderBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    invoice_line_item_id: Optional[int] = None  # set once billed to the draft

    # Nested info
    patient_name: Optional[str] = None
    vendor_name: Optional[str] = None
    # The bill this order is on (for the "added to bill INV-xxx · status" chip).
    invoice_id: Optional[int] = None
    invoice_number: Optional[str] = None
    invoice_status: Optional[str] = None

    class Config:
        from_attributes = True


# --- Inventory ledger (stock movements) ---

# Usage recorded from a case paper (always an 'out' movement).
class InventoryConsumptionCreate(BaseModel):
    patient_id: int
    case_paper_id: Optional[int] = None
    inventory_item_id: Optional[int] = None   # general stock
    medication_stock_id: Optional[int] = None # medication stock (one of the two)
    quantity: float
    # When False, record the usage (and decrement stock) but do NOT add it to the
    # case paper's draft invoice. The user can bill it later from the case paper.
    add_to_billing: bool = True

# Manual ledger entry from Inventory & Vendors (in or out).
class InventoryTransactionCreate(BaseModel):
    inventory_item_id: int
    direction: str  # 'in' | 'out'
    quantity: float
    patient_id: Optional[int] = None
    note: Optional[str] = None

class InventoryTransactionOut(BaseModel):
    id: int
    clinic_id: int
    patient_id: Optional[int] = None
    case_paper_id: Optional[int] = None
    inventory_item_id: Optional[int] = None
    medication_stock_id: Optional[int] = None
    invoice_line_item_id: Optional[int] = None
    direction: str
    action: Optional[str] = None
    item_name: str
    quantity: float
    unit: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    # Enriched for display.
    patient_name: Optional[str] = None
    invoice_id: Optional[int] = None
    invoice_number: Optional[str] = None
    invoice_status: Optional[str] = None

    class Config:
        from_attributes = True

