"""
Auth service — business logic for registration, login, and session management.
"""
from typing import Optional
from sqlalchemy.orm import Session

from models import LabUser, Lab
from core.auth import hash_password, verify_password, create_access_token
from core.countries import get_country_config
from domains.auth.repository import AuthRepository


# Default dental products to seed on lab creation
DEFAULT_PRODUCTS = [
    {"name": "Crown — PFM", "category": "crown", "material": "PFM", "unit_price": 0, "default_turnaround_days": 5},
    {"name": "Crown — Zirconia", "category": "crown", "material": "Zirconia", "unit_price": 0, "default_turnaround_days": 5},
    {"name": "Crown — E.max", "category": "crown", "material": "E.max", "unit_price": 0, "default_turnaround_days": 5},
    {"name": "Crown — Metal", "category": "crown", "material": "Metal", "unit_price": 0, "default_turnaround_days": 5},
    {"name": "Bridge — PFM", "category": "bridge", "material": "PFM", "unit_price": 0, "default_turnaround_days": 7},
    {"name": "Bridge — Zirconia", "category": "bridge", "material": "Zirconia", "unit_price": 0, "default_turnaround_days": 7},
    {"name": "Complete Denture — Upper", "category": "denture", "material": "Acrylic", "unit_price": 0, "default_turnaround_days": 10},
    {"name": "Complete Denture — Lower", "category": "denture", "material": "Acrylic", "unit_price": 0, "default_turnaround_days": 10},
    {"name": "Partial Denture — RPD Cast Metal", "category": "denture", "material": "Cast Metal", "unit_price": 0, "default_turnaround_days": 10},
    {"name": "Partial Denture — Flexible", "category": "denture", "material": "Flexible Resin", "unit_price": 0, "default_turnaround_days": 10},
    {"name": "Implant Crown", "category": "implant", "material": "Zirconia", "unit_price": 0, "default_turnaround_days": 7},
    {"name": "Implant Abutment", "category": "implant", "material": "Titanium", "unit_price": 0, "default_turnaround_days": 7},
    {"name": "Veneer — Porcelain", "category": "veneer", "material": "Porcelain", "unit_price": 0, "default_turnaround_days": 7},
    {"name": "Veneer — Composite", "category": "veneer", "material": "Composite", "unit_price": 0, "default_turnaround_days": 5},
    {"name": "Inlay / Onlay", "category": "inlay_onlay", "material": "Ceramic", "unit_price": 0, "default_turnaround_days": 5},
    {"name": "Night Guard", "category": "night_guard", "material": "Acrylic", "unit_price": 0, "default_turnaround_days": 5},
    {"name": "Aligner — Single", "category": "aligner", "material": "Clear Plastic", "unit_price": 0, "default_turnaround_days": 14},
    {"name": "Repair / Reline", "category": "repair", "material": None, "unit_price": 0, "default_turnaround_days": 3},
]


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AuthRepository(db)

    def register(self, email: str, password: str, first_name: str, last_name: str) -> dict:
        """Register a new lab owner. Creates user only — lab is created during onboarding."""
        # Check email uniqueness
        if self.repo.get_user_by_email(email):
            raise ValueError("An account with this email already exists")

        user = LabUser(
            email=email.lower().strip(),
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            name=f"{first_name.strip()} {last_name.strip()}",
            password_hash=hash_password(password),
            role="lab_owner",
            is_active=True,
        )
        user = self.repo.create_user(user)

        token = create_access_token(user.id)
        return {"token": token, "user": user}

    def login(self, email: str, password: str) -> dict:
        """Authenticate with email and password, return JWT + user."""
        user = self.repo.get_user_by_email(email.lower().strip())
        if not user:
            raise ValueError("Invalid email or password")

        if not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")

        if not user.is_active:
            raise ValueError("Account is deactivated")

        token = create_access_token(user.id)
        return {"token": token, "user": user}

    def get_me(self, user_id: int) -> Optional[LabUser]:
        """Get user by ID with lab info eagerly loaded."""
        return self.repo.get_user_by_id(user_id)

    def onboard_lab(self, user: LabUser, data: dict) -> Lab:
        """Create the lab during onboarding and associate it with the user."""
        if user.lab_id:
            raise ValueError("Lab already created — onboarding is complete")

        # Get country config
        country_cfg = get_country_config(data.get("country", "IN"))

        lab = Lab(
            name=data["name"],
            address=data.get("address"),
            phone=data.get("phone"),
            email=data.get("email"),
            country=data.get("country", "IN").upper(),
            currency_code=country_cfg["currency_code"],
            currency_symbol=country_cfg["currency_symbol"],
            timezone=country_cfg["timezone"],
            tax_label=country_cfg["tax_label"],
            tax_id=data.get("tax_id"),
            case_number_prefix=data.get("case_number_prefix", "DL").upper(),
        )
        self.db.add(lab)
        self.db.flush()  # Get lab.id

        # Link user to lab
        user.lab_id = lab.id
        self.db.flush()

        # Seed default catalog
        self._seed_default_products(lab.id)

        self.db.commit()
        self.db.refresh(lab)
        self.db.refresh(user)
        return lab

    def _seed_default_products(self, lab_id: int):
        """Seed the default dental product catalog for a new lab."""
        from models import Product
        for p in DEFAULT_PRODUCTS:
            product = Product(lab_id=lab_id, **p)
            self.db.add(product)
