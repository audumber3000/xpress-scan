"""
Phone-number normalization for messaging (WhatsApp / SMS via MSG91).

Produces a digits-only, country-coded number (no '+'). The country code is
derived from the *clinic's* country so an Indian clinic defaults to +91, a
Canadian clinic to +1, a UK clinic to +44, etc. — instead of hardcoding 91.

Rules (kept deliberately simple and safe for the existing Indian base):
  - Empty input → "".
  - A number entered with a leading '+' is treated as already E.164: we trust
    its embedded country code and just strip the '+'.
  - A single national trunk-prefix '0' (e.g. UK "07911…", IN "095…") is dropped.
  - A bare national-length number (10 digits) gets the clinic's dial code
    prepended.
  - Anything else (already includes a country code, or too short to fix) is
    returned as-is.
"""
import re

from core.countries import get_country_config

# National subscriber-number length (digits AFTER dropping the trunk '0' and
# EXCLUDING the country code). Default is 10 — only list countries that differ.
# Failure mode if a length is wrong is safe: the number simply passes through
# without a country code rather than being corrupted.
NATIONAL_LENGTHS = {
    # 8-digit national mobile
    "SG": 8, "HK": 8, "QA": 8, "KW": 8, "BH": 8, "OM": 8,
    # 9-digit national mobile
    "AE": 9, "SA": 9, "AU": 9, "FR": 9, "ES": 9, "KE": 9, "ZA": 9, "NP": 9,
    # 11-digit national mobile
    "CN": 11, "BR": 11,
}


def _dial_code(country_code: str | None) -> str:
    """Digits-only dial code for a country (defaults to India for legacy clinics)."""
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

    # "00" is the international call prefix (alternative to '+') → drop it.
    if digits.startswith("00"):
        return digits[2:]

    # Drop a single national trunk-prefix zero (UK "07…", IN "095…", AU "04…").
    if digits.startswith("0"):
        digits = digits[1:]

    # A bare national-length number → prepend the clinic's dial code.
    if len(digits) == _national_length(country_code):
        return _dial_code(country_code) + digits

    # Already includes a country code, or an unexpected length → leave as-is.
    return digits
