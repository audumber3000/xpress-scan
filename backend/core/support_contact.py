"""How a clinic reaches a person at ClinoHealth.

One module, because these now appear in three places — the support ticket
route, the suspension card, and the CRM through the Integration API — and a
phone number that disagrees with itself across screens is worse than one that
only exists in a single place.

The frontend keeps its own copy in `src/constants/support.js` for the screens
it renders on its own. When these change, change both: the constants here are
what reaches anybody who is locked out of the app entirely.
"""
import os

EMAIL = os.getenv("SUPPORT_TEAM_EMAIL", "support@molarplus.com")
PHONE = os.getenv("SUPPORT_PHONE", "+91 9594078777")

# The desk is in India, so the hours are Indian whoever is reading them.
HOURS = os.getenv("SUPPORT_HOURS", "12pm to 9pm IST")


def phone_raw() -> str:
    """Digits only — what `wa.me` and `tel:` want."""
    return "".join(ch for ch in PHONE if ch.isdigit())


def whatsapp_link(text: str = "") -> str:
    from urllib.parse import quote

    link = "https://wa.me/{}".format(phone_raw())
    return "{}?text={}".format(link, quote(text)) if text else link


def as_dict(message: str = "") -> dict:
    """The contact block a locked-out screen renders: chat, mail, or call."""
    return {
        "whatsapp": whatsapp_link(message),
        "email": EMAIL,
        "phone": PHONE,
        "phone_raw": phone_raw(),
        "hours": HOURS,
    }
