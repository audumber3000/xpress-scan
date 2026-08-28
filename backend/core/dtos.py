"""
Data Transfer Objects for API requests and responses
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date


# Patient DTOs
class PatientBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    age: Optional[int] = Field(None, ge=0, le=150)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, pattern="^(male|female|other|Male|Female|Other)$")
    village: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    referred_by: Optional[str] = Field(None, min_length=1, max_length=100)
    treatment_type: Optional[str] = Field(None, min_length=1, max_length=100)
    notes: Optional[str] = None
    payment_type: Optional[str] = Field(default="Cash", pattern="^(Cash|Card|UPI|Online)$")
    
    @field_validator('gender', mode='before')
    @classmethod
    def normalize_gender(cls, v):
        """Normalize gender values to lowercase for validation and storage"""
        if isinstance(v, str):
            return v.lower()
        return v


class PatientCreateDTO(PatientBaseDTO):
    # Optional back-date for historical patients — sets the patient's created_at
    # (registration date). Defaults to "now" when omitted.
    registered_at: Optional[datetime] = None
    # The date of registration as staff record it. Defaults to the clinic's today
    # when omitted. May be back-dated; future dates are rejected.
    registered_on: Optional[date] = None


class PatientUpdateDTO(BaseModel):
    """Fields that may be changed on an existing patient.

    Deliberately not a subclass of PatientBaseDTO: creating requires a name and
    a phone, updating requires nothing in particular. But it has to agree with
    it on *how a value is spelled*, and for a long time it did not.

    Two consequences of that drift, both fixed here:

      * gender. Create accepts "Male" and lowercases it; update matched only
        "^(male|female|other)$" with no normaliser, so the exact value the UI
        sends for every patient it had just created came back 422. Editing a
        patient could not succeed at all.
      * blood_group and patient_history were absent, so the edit form could
        collect them and the update would drop them on the floor.
        patient_history is the medical alert shown on the patient's file, which
        makes silently discarding it the worse of the two.

    display_id and primary_doctor_id stay out on purpose: the first is assigned
    by the server and shown read-only, the second is set from the case paper.
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    age: Optional[int] = Field(None, ge=0, le=150)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, pattern="^(male|female|other|Male|Female|Other)$")
    village: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    referred_by: Optional[str] = Field(None, min_length=1, max_length=100)
    treatment_type: Optional[str] = Field(None, min_length=1, max_length=100)
    blood_group: Optional[str] = Field(None, max_length=5)
    patient_history: Optional[str] = None
    notes: Optional[str] = None
    payment_type: Optional[str] = Field(None, pattern="^(Cash|Card|UPI|Online)$")
    registered_on: Optional[date] = None
    dental_chart: Optional[Dict[str, Any]] = None
    tooth_notes: Optional[Dict[str, Any]] = None
    treatment_plan: Optional[List[Dict[str, Any]]] = None
    prescriptions: Optional[List[Dict[str, Any]]] = None

    @field_validator('gender', mode='before')
    @classmethod
    def normalize_gender(cls, v):
        """Same normalisation as PatientBaseDTO, so "Male" and "male" both store
        as "male" whether the patient is being created or edited."""
        if isinstance(v, str):
            return v.lower()
        return v


class PatientResponseDTO(PatientBaseDTO):
    # Output must tolerate legacy / imported rows that predate current input rules.
    # PatientBaseDTO enforces strict constraints (phone min_length=10, gender/email
    # patterns, etc.) which are correct for *creating* a patient but must NOT reject
    # an already-stored row when *reading* the list — one bad phone would otherwise
    # 500 the entire "load patients" call. Relax the constrained fields for the response.
    name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    village: Optional[str] = None
    referred_by: Optional[str] = None
    treatment_type: Optional[str] = None
    payment_type: Optional[str] = None
    # No ge/le here: a stored row of age=2020 (a birth year typed into the age
    # field on import) once 500'd the entire patient list. Read must report what
    # is stored; range rules belong on the create/update/import DTOs.
    age: Optional[int] = None
    id: int
    clinic_id: int
    display_id: Optional[str] = None
    last_visit: Optional[datetime] = None
    # The two clinical flags the patient's file shows beside their name. Stored
    # on the row and editable in the patient form, but absent here, so neither
    # the blood group pill nor the medical alert could ever render and the edit
    # form always reopened them blank. Read must report what is stored.
    blood_group: Optional[str] = None
    patient_history: Optional[str] = None
    # Nullable on read: rows created before this column existed are backfilled
    # from created_at by migration, but an unbackfilled row must still respond.
    registered_on: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    dental_chart: Optional[Dict[str, Any]] = None
    tooth_notes: Optional[Dict[str, Any]] = None
    treatment_plan: Optional[List[Dict[str, Any]]] = None
    prescriptions: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True


class PatientSummaryDTO(BaseModel):
    id: int
    name: str
    phone: str
    age: int
    gender: str
    treatment_type: str
    last_visit: Optional[datetime] = None


# Clinic DTOs
class NullSafeResponse(BaseModel):
    """Base for response models: a NULL column can never refuse a request.

    A response model describes a row that already exists. Somebody is already
    signed in as it, it is already in the database, and refusing to serialise
    it protects nobody — it just turns a data quirk into a 500 on whichever
    route was reading it, for that one person, on every attempt, with no way
    for them to fix it.

    That has now happened four times on the sign-in path alone: a staff member
    with one name failed `last_name` min_length; four real roles missing from a
    hardcoded pattern failed `role`; a blank `first_name` failed min_length;
    a NULL `sync_status` failed `str`. Each was fixed on its own, which is
    exactly why there was a next one.

    So the rule lives here and applies to every field at once: any field that
    declares a default takes that default when the stored value is None.

    Fields with NO default are left alone deliberately. `id` or `created_at`
    being null is not a quirk, it is a broken row, and that should still fail
    loudly rather than be papered over with a guess.

    Request models must NOT inherit this. Rejecting bad input is the entire job
    of a write model, and this would quietly turn a missing required value into
    a default.
    """

    @model_validator(mode="before")
    @classmethod
    def _nulls_fall_back_to_defaults(cls, data):
        if data is None:
            return data

        # `from_attributes` means this can arrive as a SQLAlchemy row rather
        # than a dict, so read through whichever accessor fits.
        if isinstance(data, dict):
            values = dict(data)
        else:
            values = {
                name: getattr(data, name)
                for name in cls.model_fields
                if hasattr(data, name)
            }

        for name, field in cls.model_fields.items():
            if values.get(name) is None and not field.is_required():
                values[name] = field.get_default(call_default_factory=True)

        return values


class ClinicBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    tagline: Optional[str] = Field(None, max_length=120)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    gst_number: Optional[str] = None
    specialization: str = "dental"
    subscription_plan: str = "free"
    logo_url: Optional[str] = None
    primary_color: str = "#10B981"
    number_of_chairs: int = 1
    country: str = "IN"
    currency_code: str = "INR"
    currency_symbol: str = "₹"
    timezone: str = "Asia/Kolkata"
    tax_label: str = "GST No."
    tax_id: Optional[str] = None
    # Structured address. `address` stays the composed single line that
    # invoices, receipts and the mobile app read; these are its parts.
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_place_id: Optional[str] = None
    # Send patient WhatsApp messages manually from the clinic's own number.
    manual_whatsapp: bool = False
    # Practice licence — all optional so existing clinics respond unchanged.
    license_number: Optional[str] = None
    license_authority: Optional[str] = None
    license_expiry: Optional[date] = None
    # Assigned account manager (set by the support team; blank when unassigned).
    account_manager_name: Optional[str] = None
    account_manager_role: Optional[str] = None
    account_manager_email: Optional[str] = None
    account_manager_phone: Optional[str] = None


class ClinicCreateDTO(ClinicBaseDTO):
    referred_by_code: Optional[str] = None
    country: str = "IN"  # ISO 3166-1 alpha-2 — determines currency, timezone, tax defaults


class ClinicUpdateDTO(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    tagline: Optional[str] = Field(None, max_length=120)
    address: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    gst_number: Optional[str] = None
    specialization: Optional[str] = None
    subscription_plan: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    number_of_chairs: Optional[int] = None
    timings: Optional[dict] = None
    country: Optional[str] = None
    currency_code: Optional[str] = None
    currency_symbol: Optional[str] = None
    timezone: Optional[str] = None
    tax_label: Optional[str] = None
    tax_id: Optional[str] = None
    # Structured address. `address` stays the composed single line that
    # invoices, receipts and the mobile app read; these are its parts.
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_place_id: Optional[str] = None
    license_number: Optional[str] = None
    license_authority: Optional[str] = None
    license_expiry: Optional[date] = None
    manual_whatsapp: Optional[bool] = None


class ClinicResponseDTO(ClinicBaseDTO, NullSafeResponse):
    id: int
    # Unguessable public code (e.g. CLN-A3X9K2B7FQ) used to build the public
    # booking link, so the link can't be enumerated by numeric clinic id.
    clinic_code: Optional[str] = None
    status: str = "active"
    # "main_branch" / "branch" — shown on the header's clinic tile. Optional so
    # clinics created before branches existed keep responding unchanged.
    clinic_label: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    timings: Optional[dict] = None
    # Subscription/trial info (owner-level, duplicated per clinic for header display)
    plan_name: Optional[str] = None
    # What the clinic can use RIGHT NOW, which after an expiry is not plan_name.
    #
    # `subscription_plan` above ends up holding the same value, because /auth/me
    # writes the downgrade back to the column. This says it outright instead of
    # relying on every reader knowing about that side effect — mobile and the
    # support tool both pick a plan to display and neither should have to.
    effective_plan: Optional[str] = None
    is_trial: bool = False
    plan_ends_at: Optional[str] = None
    trial_days_remaining: Optional[int] = None
    # True when this clinic is eligible to start a free trial (never used one and not currently Pro/trial)
    trial_available: bool = True
    # Whether a recovery contact has actually been verified. Booleans only: the
    # phone and email themselves stay behind the owner-only /security endpoint.
    # Carried here so the profile badge and the Control Center menu can tell the
    # truth about it without either of them making a second request.
    security_phone_verified: bool = False
    security_email_verified: bool = False
    # True when this clinic still owes us the signup verification step.
    #
    # Grandfathered by clinic age: clinics that existed before verification was
    # introduced are never asked, because turning it on retrospectively would
    # lock every current customer out of their own account on deploy day.
    security_verification_required: bool = False
    # Where the clinic stands with its plan: 'ok', 'renewal_due', 'grant_due',
    # 'trial_ended', 'lapsed' or 'grant_ended'. Carried here so the header can
    # warn in the last few days without a second request, and so every client
    # reads the same answer as the middleware that enforces it.
    plan_state: Optional[str] = None
    plan_state_days: Optional[int] = None
    plan_state_title: Optional[str] = None

    class Config:
        from_attributes = True


# User DTOs
class UserBaseDTO(BaseModel):
    # Either email (owners) or username (staff) — at least one is always set,
    # but each is independently optional on the response.
    email: Optional[str] = Field(None)
    username: Optional[str] = Field(None)
    first_name: str = Field(..., min_length=1, max_length=50)
    # Optional, because plenty of people have one name. Staff creation splits a
    # full name on the first space and leaves this empty for a single word, so a
    # required last_name meant somebody called "Priya" could be created happily
    # and then got a 500 on every sign-in — the DTO rejected the very row that
    # had just been written.
    last_name: str = Field("", max_length=50)
    # Validated against the real catalogue instead of a hardcoded three. The old
    # pattern predated in_house_doctor, associate, consultant and assistant, so
    # staff in any of those four roles could be created, appeared in the list,
    # and then failed to sign in with a 500 from this line.
    role: str = Field(...)

    @field_validator("role")
    @classmethod
    def _known_role(cls, v: str) -> str:
        from core.roles import ROLES
        allowed = {r["value"] for r in ROLES}
        if v not in allowed:
            raise ValueError(f"Unknown role. Expected one of: {', '.join(sorted(allowed))}")
        return v


class UserCreateDTO(UserBaseDTO):
    password: str = Field(..., min_length=8)
    clinic_id: Optional[int] = None


class UserUpdateDTO(BaseModel):
    email: Optional[str] = Field(None, pattern=r"^[^@]+@[^@]+\.[^@]+$")
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    role: Optional[str] = Field(None, pattern="^(clinic_owner|doctor|receptionist)$")


class UserResponseDTO(UserBaseDTO, NullSafeResponse):
    """What a user looks like on the way OUT.

    Every constraint inherited from UserBaseDTO is relaxed here, on purpose.
    That base is shared with UserCreateDTO, where strictness is right: it is
    guarding a write, and rejecting a blank name stops bad data being stored.
    On the way out it guards nothing. The row already exists, somebody is
    already signed in as it, and a validation error at this point does not
    protect anyone — it turns a data quirk into a 500 on the login route, for
    that one person, on every single attempt, with no way for them to fix it.

    This is the FOURTH time the same shape has bitten. A staff member with one
    name failed `last_name` min_length. Four real roles missing from a hardcoded
    pattern failed `role`. A blank `first_name` failed min_length. Then a NULL
    `sync_status` failed `str` — and that one was found only by running the
    server against a real database, after the first three had each been fixed
    one field at a time.

    Fixing them one field at a time is what guarantees a fifth, so the rule now
    lives in NullSafeResponse and applies to every field of both response models
    at once. See that class.
    """

    id: int
    name: str = ""  # computed from first + last
    clinic_id: Optional[int] = None
    permissions: Dict[str, Any] = {}
    is_active: bool = True
    # Optional on the way OUT only. See the class docstring: real rows exist
    # with a null updated_at, and refusing to describe them locks those accounts
    # out of the product entirely.
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None
    sync_status: str = "local"
    signature_url: Optional[str] = None
    # Optional profile fields — additive, default None so login/onboarding/signup
    # responses are unchanged for accounts that never set them.
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    clinics: List[ClinicResponseDTO] = []

    # Overridden to be permissive. See the class docstring.
    first_name: str = Field("", max_length=50)
    last_name: str = Field("", max_length=50)
    role: str = ""


    @field_validator("role")
    @classmethod
    def _known_role(cls, v: str) -> str:
        """Deliberately shadows the base's role check by reusing its NAME.

        A same-named method is how a Pydantic v2 subclass replaces an inherited
        validator; defining a differently-named one just adds a second check and
        the strict parent still runs.

        A role this build has not heard of is a real row in the database that
        somebody is signed in as. Refusing to serialise it locks that person out
        of the product until a deploy. Reporting what is stored is the only
        useful thing to do with it.
        """
        return v

    class Config:
        from_attributes = True


class UpdateProfileDTO(BaseModel):
    """Self-service profile edits from the profile page. All fields optional;
    only provided fields are updated. Does not touch role/email/clinic."""
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    phone: Optional[str] = Field(None, max_length=20)


# Payment DTOs
class PaymentBaseDTO(BaseModel):
    patient_id: int = Field(..., gt=0)
    report_id: Optional[int] = None
    treatment_type_id: Optional[int] = None
    amount: float = Field(..., gt=0)
    payment_method: str = Field(..., pattern="^(Cash|Card|PayPal|Net Banking|UPI)$")
    transaction_id: Optional[str] = None
    notes: Optional[str] = None
    paid_by: Optional[str] = None


class PaymentCreateDTO(PaymentBaseDTO):
    pass


class PaymentResponseDTO(PaymentBaseDTO):
    id: int
    clinic_id: int
    status: str = "success"
    received_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True


# Auth DTOs
class LoginRequestDTO(BaseModel):
    # Login identifier: either an email address (owners, OAuth-linked accounts)
    # or a username (staff). The field is still named ``email`` for backward
    # compatibility with the existing web/mobile clients, but the pattern
    # constraint has been removed so usernames pass validation.
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    device: Optional[Dict[str, Any]] = None


class RegisterRequestDTO(BaseModel):
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    role: str = Field(..., pattern="^(clinic_owner|doctor|receptionist)$")


class OAuthRequestDTO(BaseModel):
    id_token: str = Field(..., min_length=1)
    device: Optional[Dict[str, Any]] = None
    role: Optional[str] = Field(None, pattern="^(clinic_owner|doctor|receptionist)$")


class OAuthCodeRequestDTO(BaseModel):
    """Used by desktop app: exchange authorization code for id_token."""
    code: str = Field(..., min_length=1)
    redirect_uri: str = Field(..., min_length=1)
    device: Optional[Dict[str, Any]] = None
    role: Optional[str] = Field(None, pattern="^(clinic_owner|doctor|receptionist)$")


class ChangePasswordRequestDTO(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class AuthResponseDTO(BaseModel):
    message: str
    user: UserResponseDTO
    token: str
    clinic: Optional[ClinicResponseDTO] = None


class DeviceInfoDTO(BaseModel):
    device_name: str
    device_type: str
    device_platform: str
    device_os: str
    device_serial: str
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None


# Common response DTOs
class PaginatedResponseDTO(BaseModel):
    items: List[Any]
    total: int
    page: int = 1
    page_size: int = 100
    total_pages: int = 1


class ErrorResponseDTO(BaseModel):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None


class SuccessResponseDTO(BaseModel):
    message: str
    data: Optional[Any] = None

# Vendor DTOs
class VendorBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    category: Optional[str] = "General"
    last_order_date: Optional[datetime] = None

class VendorCreateDTO(VendorBaseDTO):
    pass

class VendorUpdateDTO(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: Optional[bool] = None

class VendorResponseDTO(VendorBaseDTO):
    id: int
    clinic_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Inventory DTOs
class InventoryItemBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = None
    quantity: float = 0.0
    unit: Optional[str] = None
    min_stock_level: float = 0.0
    price_per_unit: float = 0.0
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None

class InventoryItemCreateDTO(InventoryItemBaseDTO):
    vendor_id: Optional[int] = None

class InventoryItemUpdateDTO(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    min_stock_level: Optional[float] = None
    price_per_unit: Optional[float] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    vendor_id: Optional[int] = None

class InventoryItemResponseDTO(InventoryItemBaseDTO):
    id: int
    clinic_id: int
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Medication stock DTOs
class MedicationStockBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    form: Optional[str] = None
    quantity: float = 0.0            # in base units (unit)
    unit: Optional[str] = None       # base/dispensing unit (tablet, ml, ...)
    pack_unit: Optional[str] = None
    units_per_pack: Optional[float] = None
    min_stock_level: float = 0.0
    price_per_unit: float = 0.0
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    schedule: Optional[str] = None

class MedicationStockCreateDTO(MedicationStockBaseDTO):
    vendor_id: Optional[int] = None

class MedicationStockUpdateDTO(BaseModel):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    form: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    pack_unit: Optional[str] = None
    units_per_pack: Optional[float] = None
    min_stock_level: Optional[float] = None
    price_per_unit: Optional[float] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[date] = None
    schedule: Optional[str] = None
    vendor_id: Optional[int] = None

class MedicationStockResponseDTO(MedicationStockBaseDTO):
    id: int
    clinic_id: int
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Consent DTOs
class ConsentTemplateBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1)
    category: Optional[str] = None

class ConsentTemplateCreateDTO(ConsentTemplateBaseDTO):
    pass

class ConsentTemplateUpdateDTO(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class ConsentTemplateResponseDTO(ConsentTemplateBaseDTO):
    id: int
    clinic_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PatientConsentCreateDTO(BaseModel):
    template_id: int
    signed_content: str
    signature_url: Optional[str] = None

class PatientConsentResponseDTO(BaseModel):
    id: int
    patient_id: int
    template_id: int
    template_name: str
    signed_content: str
    signature_url: Optional[str] = None
    signed_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# Document DTOs
class PatientDocumentResponseDTO(BaseModel):
    id: int
    patient_id: int
    clinic_id: int
    case_paper_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: int
    file_type: str
    uploader_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ExternalDocumentRequestDTO(BaseModel):
    clinic_id: int
    file_name: str
    file_path: str
    file_size: Optional[int] = 0
    file_type: Optional[str] = "pdf"

class UnifiedFileResponseDTO(BaseModel):
    id: int
    patient_id: int
    clinic_id: int
    case_paper_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: Optional[int] = 0
    file_type: str
    uploader_name: Optional[str] = "System"
    created_at: datetime
    category: str  # 'document' or 'report'
    # Unguessable token for GET /documents/{id}/thumbnail. That endpoint stays
    # header-less because it is used as an <img src>, so the token is what stops
    # sequential ids from exposing every clinic's imaging. Absent for reports,
    # which have no thumbnail endpoint.
    thumbnail_token: Optional[str] = None

    class Config:
        from_attributes = True


# Prescription DTOs
class PrescriptionItemDTO(BaseModel):
    medicine_name: str
    dosage: str  # e.g., "1-0-1"
    duration: str  # e.g., "5 days"
    quantity: str
    notes: Optional[str] = None
    instructions: Optional[str] = None  # e.g., "After Food", "Empty Stomach"


class PrescriptionRequestDTO(BaseModel):
    items: List[PrescriptionItemDTO]
    notes: Optional[str] = None


class PrescriptionPDFResponseDTO(BaseModel):
    pdf_url: str
    file_name: str


# Medication DTOs
class MedicationBaseDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    dosage: Optional[str] = None
    duration: Optional[str] = None
    quantity: Optional[str] = None
    notes: Optional[str] = None
    category: str = "General"

class MedicationCreateDTO(MedicationBaseDTO):
    pass

class MedicationUpdateDTO(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    duration: Optional[str] = None
    quantity: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class MedicationResponseDTO(MedicationBaseDTO):
    id: int
    clinic_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Template Configuration DTOs
_HEX_COLOR_RE = r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
_ALLOWED_CATEGORIES = {"invoice", "prescription", "consent"}
_FOOTER_TEXT_MAX = 1000


def _validate_logo_url(v: Optional[str]) -> Optional[str]:
    """Reject anything that isn't an https URL pointing at a real host.
    Blocks SSRF vectors (file://, http://169.254.169.254/, internal IPs)."""
    if v is None or v == "":
        return v or None
    from urllib.parse import urlparse
    try:
        parsed = urlparse(v)
    except Exception:
        raise ValueError("logo_url must be a valid URL")
    if parsed.scheme != "https":
        raise ValueError("logo_url must use https://")
    if not parsed.netloc or parsed.netloc.startswith("localhost") or parsed.netloc.startswith("127.") \
            or parsed.netloc.startswith("169.254.") or parsed.netloc.startswith("10.") \
            or parsed.netloc.startswith("192.168.") or parsed.netloc.startswith("0."):
        raise ValueError("logo_url host not allowed")
    if len(v) > 2048:
        raise ValueError("logo_url too long")
    return v


class TemplateConfigBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=32)
    template_id: str = Field(..., min_length=1, max_length=64)
    logo_url: Optional[str] = None
    footer_text: Optional[str] = Field(None, max_length=_FOOTER_TEXT_MAX)
    primary_color: Optional[str] = Field(None, pattern=_HEX_COLOR_RE)
    secondary_color: Optional[str] = Field(None, pattern=_HEX_COLOR_RE)
    config_json: Optional[Dict[str, Any]] = None

    @field_validator("category")
    @classmethod
    def _check_category(cls, v: str) -> str:
        if v not in _ALLOWED_CATEGORIES:
            raise ValueError(f"category must be one of {sorted(_ALLOWED_CATEGORIES)}")
        return v

    @field_validator("logo_url")
    @classmethod
    def _check_logo_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_logo_url(v)


class TemplateConfigCreate(TemplateConfigBase):
    pass


class TemplateConfigUpdate(BaseModel):
    template_id: Optional[str] = Field(None, min_length=1, max_length=64)
    logo_url: Optional[str] = None
    footer_text: Optional[str] = Field(None, max_length=_FOOTER_TEXT_MAX)
    primary_color: Optional[str] = Field(None, pattern=_HEX_COLOR_RE)
    secondary_color: Optional[str] = Field(None, pattern=_HEX_COLOR_RE)
    config_json: Optional[Dict[str, Any]] = None

    @field_validator("logo_url")
    @classmethod
    def _check_logo_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_logo_url(v)

class TemplateConfigResponse(TemplateConfigBase):
    id: Optional[int] = None
    clinic_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True