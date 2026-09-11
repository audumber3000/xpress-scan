"""
Authentication utilities for Dental Labs.

Email/password only — no Firebase, no OAuth.
Uses standard bcrypt library.
"""
import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
from models import LabUser

# ── JWT config ──────────────────────────────────────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "dental-labs-dev-secret-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_DAYS = int(os.getenv("JWT_EXPIRY_DAYS", "7"))


# ── Password hashing ───────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a password with bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


# ── JWT helpers ─────────────────────────────────────────────────────────

def create_access_token(user_id: int) -> str:
    """Create a JWT access token with user_id claim."""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token. Returns payload or None."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


# ── FastAPI dependencies ────────────────────────────────────────────────

def get_current_user(request: Request, db: Session = Depends(get_db)) -> LabUser:
    """Extract and validate the current user from the Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.split(" ", 1)[1]
    payload = decode_access_token(token)
    if not payload or "user_id" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(LabUser).filter(LabUser.id == payload["user_id"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or deactivated")

    return user


def require_role(*allowed_roles: str):
    """Dependency factory — restricts access to specific roles.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_role("lab_owner"))])
    """
    def role_checker(user: LabUser = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires one of {allowed_roles} role(s)",
            )
        return user
    return role_checker


# ── Convenience shortcuts ──────────────────────────────────────────────

require_lab_owner = require_role("lab_owner")
require_any_lab_user = require_role("lab_owner", "lab_staff")
