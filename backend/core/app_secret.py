"""
The one place JWT_SECRET is read.

It used to be read in three: core.auth_utils, core.master_password and
AuthService, each with its own `os.getenv("JWT_SECRET", "your-secret-key")`.
Three copies of a fallback is how a secret silently diverges, and a token signed
by one path and rejected by another looks exactly like a session that expired
for no reason.

The placeholder default is kept for local development only, and preflight.py
refuses to start the container if the real value is missing or is still the
placeholder, so it cannot reach production by accident.
"""
import hashlib
import os

DEV_PLACEHOLDER = "your-secret-key"


def get_jwt_secret() -> str:
    return os.getenv("JWT_SECRET", DEV_PLACEHOLDER)


def secret_fingerprint(secret: str | None = None) -> str:
    """A short, non-reversible tag for the signing secret.

    Exists to answer one question without ever printing the secret: is the
    secret on this host the same one that signed the tokens people are still
    carrying? If it changed during a host migration, every existing session died
    at the moment of cutover, which looks to customers like being logged out at
    random and is indistinguishable from a bug in the app.

    Run preflight on both hosts and compare the eight characters. Same tag means
    the secret survived the move; different means every token was invalidated
    and the forced sign-outs are explained.

    SHA-256 truncated to 8 hex characters. Enough to tell two secrets apart,
    far too little to attack the secret itself.
    """
    value = secret if secret is not None else get_jwt_secret()
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]
