"""Platform outreach on WhatsApp, from ClinoHealth's own number.

When somebody finishes signing up, a real person says hello. Not a template,
not a no-reply address — a message from the number our support and sales team
actually answers, so the reply lands somewhere a human reads.

─── Why this is in `integration/` ─────────────────────────────────────────────

Because it is our business, not the clinic's. Everything in this package serves
ClinoHealth rather than the product's own users: the CRM's reads, the pipeline,
the support panels. This is the same audience — support and conversion — and it
sends from our number, on our account, at our cost. It has no more to do with a
clinic's own messaging than `/leads` does.

─── The three WhatsApp paths, and why this is a third one ─────────────────────

Easy to confuse, so plainly:

  1. **MSG91** — the clinic messaging its patients through approved templates,
     charged to the clinic's wallet. `core/notification_dispatch.py`.
  2. **WA Reach** — the clinic messaging its patients from *its own* connected
     number, free to them. `domains/notification/services/wareach_service.py`.
  3. **This** — ClinoHealth messaging the clinic's owner from *our* number.
     Never charged to anybody, never sent to a patient.

They share a protocol and nothing else. This module deliberately imports from
neither of the others: a change to how clinics message patients must not be
able to change how we introduce ourselves, and vice versa.

─── Off unless configured ─────────────────────────────────────────────────────

`PLATFORM_WA_URL` and `PLATFORM_WA_KEY` must both be set or every call here is
a no-op that returns False. Signup must never depend on it, and a developer
running locally must never message a real person by accident.

⚠️  The self-hosted endpoint currently speaks plain HTTP, which puts the bearer
token and the recipient's number on the wire in clear. That is acceptable for
an internal box while the feature is being proved and is not acceptable in
front of customers — the same HTTPS-before-prod note that already hangs over
WA Reach applies here.
"""
import datetime
import logging
import os
import re

import httpx

from core.phone import normalize_phone

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
# No default URL and no default key on purpose. A default endpoint is how a test
# run ends up messaging somebody, and a default key is a secret in the repo.
OUTREACH_URL = (os.getenv("PLATFORM_WA_URL") or "").rstrip("/")
OUTREACH_KEY = os.getenv("PLATFORM_WA_KEY") or ""
# Whose name is on the message. It is a person saying hello, so it needs to be a
# person's name, and the person answering replies should be the one named here.
OUTREACH_AGENT = os.getenv("PLATFORM_WA_AGENT") or "Rohit"
# Belt as well as braces: even fully configured, staging can switch it off.
OUTREACH_DISABLED = (os.getenv("PLATFORM_WA_DISABLED") or "") in ("1", "true", "True")

TIMEOUT_SECONDS = 10
PROVIDER = "platform_wa"


def is_configured() -> bool:
    return bool(OUTREACH_URL and OUTREACH_KEY and not OUTREACH_DISABLED)


def send_text(to: str, text: str) -> tuple[bool, str]:
    """One WhatsApp message from our number. Returns (sent, detail).

    Never raises. Every caller is a side effect of something the user actually
    asked for — finishing signup — and none of them may fail because a message
    did not go out.
    """
    if not is_configured():
        return False, "platform whatsapp is not configured"

    number = normalize_phone(to)
    if not number or len(number) < 8:
        return False, "no usable phone number"

    try:
        resp = httpx.post(
            f"{OUTREACH_URL}/api/v1/messages",
            headers={"Authorization": f"Bearer {OUTREACH_KEY}"},
            json={"to": number, "text": text},
            timeout=TIMEOUT_SECONDS,
        )
    except Exception as exc:  # noqa: BLE001
        # The type only. The body of a failed request can echo the payload back,
        # and the payload is somebody's phone number.
        logger.warning("platform whatsapp send failed: %s", type(exc).__name__)
        return False, type(exc).__name__

    if resp.status_code >= 400:
        logger.warning("platform whatsapp refused: HTTP %s", resp.status_code)
        return False, f"HTTP {resp.status_code}"
    return True, "sent"


# ── The messages ──────────────────────────────────────────────────────────────

def _first_name(full: str | None) -> str:
    """"Dr. Rajesh Sharma" -> "Rajesh". Titles stripped, because the greeting
    adds "Dr" back and "Hi Dr Dr Sharma" is how a bot introduces itself."""
    cleaned = re.sub(r"^\s*(dr\.?|doctor|mr\.?|mrs\.?|ms\.?)\s+", "", (full or "").strip(), flags=re.I)
    first = cleaned.split(" ")[0].strip()
    return first or ""


def signup_greeting(owner_name: str | None, clinic_name: str | None) -> str:
    """The hello.

    Written as one person to another, not as an announcement. Three things do
    the work:

      * it uses their name. "Hi Sir" is polite and anonymous, and anonymous is
        the opposite of the thing this message is trying to say. The name is
        the single clearest signal that a person looked at the account.
      * it offers something specific (a live walkthrough) rather than the
        generic "reach out anytime" that everybody ignores.
      * it says nothing is too small to ask about, because the reason a new
        customer goes quiet is almost always that they think their question is
        stupid.

    No links and no pitch. The only thing it asks for is a reply.
    """
    who = _first_name(owner_name)
    hi = f"Hi Dr {who}," if who else "Hi Doctor,"
    came_on = f"I saw {clinic_name} just came on board" if clinic_name else "I saw you just came on board"
    return (
        f"{hi} this is {OUTREACH_AGENT} from MolarPlus Dental Software.\n\n"
        f"{came_on}, so I wanted to check in myself rather than leave you to work "
        "it all out alone.\n\n"
        "If anything is unclear, or it's not behaving the way you expect, or you'd "
        "like us to walk you through it on a live demo, just tell me. Nothing is "
        "too small to ask about.\n\n"
        "Reply right here whenever suits you. This is my own number and I'm always "
        "happy to help. \U0001F64C"
    )


def greet_new_signup(db, clinic, owner) -> bool:
    """Say hello to a clinic that has just finished onboarding.

    Recorded in notification_logs so support can see whether the introduction
    actually went out, at zero cost and under its own provider name — this is
    ClinoHealth's message on ClinoHealth's number, and billing it to the clinic's
    wallet would charge them for being sold to.

    Sends once per clinic, ever. Onboarding can be completed more than once (a
    retried request, an owner revisiting the wizard), and "hi, I saw you just
    signed up" arriving twice reads worse than not arriving at all.
    """
    if not is_configured():
        return False

    phone = getattr(clinic, "phone", None) or getattr(owner, "phone", None)
    if not phone:
        return False

    from models import NotificationLog

    try:
        already = db.query(NotificationLog).filter(
            NotificationLog.clinic_id == clinic.id,
            NotificationLog.event_type == "platform_signup_hello",
        ).first()
        if already:
            return False
    except Exception:  # noqa: BLE001
        # If the ledger cannot be read we would rather not guess, because the
        # failure mode of guessing wrong is a duplicate to a new customer.
        logger.exception("could not check platform outreach history")
        return False

    text = signup_greeting(getattr(owner, "name", None), getattr(clinic, "name", None))
    sent, detail = send_text(phone, text)

    try:
        db.add(NotificationLog(
            clinic_id=clinic.id,
            channel="whatsapp",
            recipient=normalize_phone(phone),
            event_type="platform_signup_hello",
            template_name="platform_signup_hello",
            status="sent" if sent else "failed",
            cost=0.0,
            provider=PROVIDER,
            error_message=None if sent else detail,
            created_at=datetime.datetime.utcnow(),
        ))
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
        logger.exception("could not record platform outreach")

    return sent
