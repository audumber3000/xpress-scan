"""
Phone-number normalization for WhatsApp messaging (via MSG91).

Produces a digits-only, country-coded number (no '+'). The country code is
derived from the *lab's* country so an Indian lab defaults to +91, a UK lab
to +44, etc. Standalone for Dental Labs — mirrors the MolarPlus logic but
keyed off the lab country.
"""
import re

from core.countries import get_country_config

# National subscriber-number length (digits AFTER dropping the trunk '0' and
# EXCLUDING the country code). Default 10 — only list countries that differ.
NATIONAL_LENGTHS = {
    "SG": 8, "HK": 8, "QA": 8, "KW": 8, "BH": 8, "OM": 8,
    "AE": 9, "SA": 9, "AU": 9, "FR": 9, "ES": 9, "KE": 9, "ZA": 9, "NP": 9,
    "CN": 11, "BR": 11,
}


def _dial_code(country_code: str | None) -> str:
    cfg = get_country_config(country_code or "IN")
    return re.sub(r"\D", "", cfg.get("phone_code", "+91")) or "91"


def _national_length(country_code: str | None) -> int:
    return NATIONAL_LENGTHS.get((country_code or "IN").upper(), 10)


def normalize_phone(raw: str | None, country_code: str | None = None) -> str:
    """Return a digits-only, country-coded phone number for messaging, or ""."""
    raw = (raw or "").strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    # Entered with '+' → already E.164, trust the embedded country code.
    if raw.startswith("+"):
        return digits

    # "00" international call prefix → drop it.
    if digits.startswith("00"):
        return digits[2:]

    # Drop a single national trunk-prefix zero.
    if digits.startswith("0"):
        digits = digits[1:]

    # Bare national-length number → prepend the lab's dial code.
    if len(digits) == _national_length(country_code):
        return _dial_code(country_code) + digits

    # Already country-coded, or unexpected length → leave as-is.
    return digits
