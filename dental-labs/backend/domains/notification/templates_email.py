"""
Email template builders for Dental Labs events.

Maps event_type -> {"subject", "html"}. Unlike WhatsApp, email needs no provider
approval, so these render real content immediately. Each builder wraps its body
in a branded shell carrying the lab's name.
"""
import datetime


def _wrap(lab_name: str, body_html: str) -> str:
    """Clean branded HTML email shell (lab letterhead + footer)."""
    year = datetime.datetime.now().year
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f4f6f9; }}
    .wrapper {{ max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }}
    .header {{ background:#2a276e; padding:28px 32px; text-align:center; }}
    .header h2 {{ margin:0; color:#fff; font-size:20px; letter-spacing:.5px; }}
    .content {{ padding:32px; color:#374151; line-height:1.7; font-size:15px; }}
    .content p {{ margin:0 0 14px; }}
    .case {{ font-weight:600; color:#2a276e; }}
    .footer {{ background:#f9fafb; padding:20px 32px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #f3f4f6; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h2>{lab_name}</h2></div>
    <div class="content">{body_html}</div>
    <div class="footer">© {year} {lab_name} · Powered by MolarPlus Labs</div>
  </div>
</body>
</html>"""


def _greeting(client_name: str) -> str:
    return f"<p>Dear {client_name},</p>" if client_name else "<p>Hello,</p>"


def email_case_received(client_name, lab_name, case_number, patient_name, lab_phone="", **_):
    body = (
        _greeting(client_name)
        + f"<p>We've received your case <span class='case'>{case_number}</span>"
        + (f" for patient <strong>{patient_name}</strong>" if patient_name else "")
        + " and started work on it.</p>"
        + "<p>We'll keep you updated as it progresses.</p>"
        + (f"<p>Questions? Call us at {lab_phone}.</p>" if lab_phone else "")
    )
    return {"subject": f"Case {case_number} received — {lab_name}", "html": _wrap(lab_name, body)}


def email_case_dispatched(client_name, lab_name, case_number, patient_name, lab_phone="", **_):
    body = (
        _greeting(client_name)
        + f"<p>Good news — case <span class='case'>{case_number}</span>"
        + (f" for patient <strong>{patient_name}</strong>" if patient_name else "")
        + " has been dispatched and is on its way to you.</p>"
        + (f"<p>Questions? Call us at {lab_phone}.</p>" if lab_phone else "")
    )
    return {"subject": f"Case {case_number} dispatched — {lab_name}", "html": _wrap(lab_name, body)}


def email_case_delivered(client_name, lab_name, case_number, patient_name, lab_phone="", **_):
    body = (
        _greeting(client_name)
        + f"<p>Case <span class='case'>{case_number}</span>"
        + (f" for patient <strong>{patient_name}</strong>" if patient_name else "")
        + " has been delivered. Thank you for your business!</p>"
        + (f"<p>Questions? Call us at {lab_phone}.</p>" if lab_phone else "")
    )
    return {"subject": f"Case {case_number} delivered — {lab_name}", "html": _wrap(lab_name, body)}


def email_statement_ready(client_name, lab_name, period_label, amount, lab_phone="", **_):
    body = (
        _greeting(client_name)
        + f"<p>Your statement for <strong>{period_label}</strong> is ready.</p>"
        + f"<p>Total due: <span class='case'>{amount}</span></p>"
        + "<p>The statement is attached to this email.</p>"
        + (f"<p>Questions? Call us at {lab_phone}.</p>" if lab_phone else "")
    )
    return {"subject": f"Statement for {period_label} — {lab_name}", "html": _wrap(lab_name, body)}


_BUILDERS = {
    "case_received": email_case_received,
    "case_dispatched": email_case_dispatched,
    "case_delivered": email_case_delivered,
    "statement_ready": email_statement_ready,
}


def build_email(event_type: str, **kwargs) -> dict:
    """Return {"subject", "html"} for the event, or raise ValueError."""
    builder = _BUILDERS.get(event_type)
    if not builder:
        raise ValueError(f"No email template for event '{event_type}'")
    return builder(**kwargs)
