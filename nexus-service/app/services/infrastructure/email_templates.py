"""
Email HTML template builders for all notification events.

Two sender streams:
  - Platform → Clinic  (clinic@molarplus.com)   — system events, not charged to clinic
  - Clinic   → Patient (care@molarplus.com)      — clinical events, charged to clinic wallet
"""

from datetime import datetime

MOLARPLUS_LOGO_URL   = "https://molarplus.com/molarplus-logo-transparent.svg"
BRAND_COLOR          = "#29828a"
DARK_COLOR           = "#1a1548"
SUPPORT_PHONE        = "+91 9594078777"
SUPPORT_EMAIL        = "support@molarplus.com"

_SUPPORT_BLOCK = (
    f'<div style="margin-top:18px;padding:12px 16px;background:#f0fafa;border-radius:8px;'
    f'font-size:13px;color:#4b5563;text-align:center;">'
    f'Need help? Reach us on '
    f'<a href="https://wa.me/919594078777" style="color:{BRAND_COLOR};font-weight:700;text-decoration:none;">'
    f'WhatsApp {SUPPORT_PHONE}</a>'
    f' &nbsp;·&nbsp; '
    f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{BRAND_COLOR};font-weight:700;text-decoration:none;">'
    f'{SUPPORT_EMAIL}</a>'
    f'</div>'
)


def _base_wrapper(header_html: str, body_html: str, footer_html: str) -> str:
    year = datetime.now().year
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    *{{margin:0;padding:0;box-sizing:border-box;}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f4f6f9;color:#374151;}}
    .wrapper{{max-width:600px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);}}
    .header{{padding:28px 36px;}}
    .content{{padding:32px 36px;font-size:15px;line-height:1.75;}}
    .content p{{margin-bottom:14px;}}
    .content strong{{color:#111827;}}
    .btn{{display:inline-block;margin:18px 0 6px;padding:13px 28px;background:{BRAND_COLOR};color:#fff;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:.3px;}}
    .divider{{border:none;border-top:1px solid #f0f0f0;margin:20px 0;}}
    .info-box{{background:#f9fafb;border-left:4px solid {BRAND_COLOR};border-radius:0 8px 8px 0;padding:14px 18px;margin:16px 0;font-size:14px;color:#4b5563;}}
    .info-box strong{{display:block;color:#111827;margin-bottom:4px;font-size:15px;}}
    .footer{{background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #f0f0f0;}}
    .footer-logo{{height:22px;opacity:.7;margin-bottom:8px;}}
    .footer p{{font-size:12px;color:#9ca3af;line-height:1.6;}}
  </style>
</head>
<body>
  <div class="wrapper">
    {header_html}
    <div class="content">{body_html}</div>
    <div class="footer">
      {footer_html}
      <p>© {year} MolarPlus · All rights reserved<br/>
      <a href="https://molarplus.com" style="color:{BRAND_COLOR};text-decoration:none;">molarplus.com</a></p>
    </div>
  </div>
</body>
</html>"""


def _platform_header() -> str:
    """MolarPlus-branded header for platform→clinic emails."""
    return f"""<div class="header" style="background:{DARK_COLOR};text-align:center;">
      <img src="{MOLARPLUS_LOGO_URL}" alt="MolarPlus" style="height:36px;filter:brightness(0) invert(1);" />
    </div>"""


def _clinic_header(clinic_name: str, clinic_logo_url: str = "") -> str:
    """Clinic-branded header for clinic→patient emails."""
    if clinic_logo_url:
        logo_html = f'<img src="{clinic_logo_url}" alt="{clinic_name}" style="max-height:48px;max-width:160px;object-fit:contain;" />'
    else:
        initial = clinic_name[0].upper() if clinic_name else "C"
        logo_html = (
            f'<div style="width:48px;height:48px;border-radius:12px;background:{BRAND_COLOR};'
            f'display:inline-flex;align-items:center;justify-content:center;'
            f'font-size:24px;font-weight:900;color:#fff;">{initial}</div>'
        )
    return f"""<div class="header" style="background:#fff;border-bottom:3px solid {BRAND_COLOR};display:flex;align-items:center;gap:14px;">
      {logo_html}
      <div>
        <div style="font-size:18px;font-weight:800;color:#111827;">{clinic_name}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">Dental &amp; Healthcare</div>
      </div>
    </div>"""


def _platform_footer() -> str:
    return (
        f'<img src="{MOLARPLUS_LOGO_URL}" alt="MolarPlus" class="footer-logo" /><br/>'
        f'<p style="font-size:12px;color:#6b7280;margin:6px 0;">'
        f'Need help? '
        f'<a href="https://wa.me/919594078777" style="color:{BRAND_COLOR};font-weight:700;text-decoration:none;">WhatsApp {SUPPORT_PHONE}</a>'
        f' &nbsp;·&nbsp; '
        f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{BRAND_COLOR};text-decoration:none;">{SUPPORT_EMAIL}</a>'
        f'</p>'
    )


def _clinic_footer(clinic_name: str) -> str:
    return (
        f'<p style="font-size:13px;color:#6b7280;margin-bottom:6px;">Sent by <strong style="color:#111827;">{clinic_name}</strong></p>'
        f'<img src="{MOLARPLUS_LOGO_URL}" alt="MolarPlus" class="footer-logo" />'
        f'<p style="font-size:11px;color:#9ca3af;">Powered by MolarPlus</p>'
    )


# ─── Platform → Clinic templates ──────────────────────────────────────────────

def platform_welcome(owner_name: str, clinic_name: str) -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Welcome to <strong>MolarPlus</strong>! 🎉 Your clinic <strong>{clinic_name}</strong> is now live on the platform.</p>
<p>You can start managing your patients, appointments, prescriptions, and billing right away.</p>
<div class="info-box">
  <strong>What's next?</strong>
  Complete your clinic profile, add your team members, and set up your first treatment types.
</div>
<p>If you have any questions, our support team is always here to help.</p>
<a href="https://app.molarplus.com/dashboard" class="btn">Go to Dashboard →</a>
<p style="font-size:13px;color:#9ca3af;">Happy practising,<br/>The MolarPlus Team</p>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Welcome to MolarPlus, {owner_name}! 🎉",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_branch_added(owner_name: str, branch_name: str) -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Your new branch <strong>{branch_name}</strong> has been successfully added to your MolarPlus account.</p>
<div class="info-box">
  <strong>Branch details</strong>
  {branch_name} is now accessible from your clinic switcher. You can manage its staff, settings, and data independently.
</div>
<p>You can switch between branches anytime from the top navigation bar in your dashboard.</p>
<a href="https://app.molarplus.com/admin/clinic" class="btn">Manage Branches →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"New branch added: {branch_name}",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_subscription_purchased(owner_name: str, clinic_name: str, plan_name: str, valid_until: str) -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Your subscription for <strong>{clinic_name}</strong> has been activated successfully.</p>
<div class="info-box">
  <strong>Plan: {plan_name}</strong>
  Valid until: {valid_until}
</div>
<p>You now have access to all features included in the <strong>{plan_name}</strong> plan. Thank you for choosing MolarPlus!</p>
<a href="https://app.molarplus.com/admin/subscription" class="btn">View Subscription →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Subscription activated — {plan_name} plan",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_wallet_topup(owner_name: str, clinic_name: str, amount: float, new_balance: float) -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Your notification wallet for <strong>{clinic_name}</strong> has been topped up successfully.</p>
<div class="info-box">
  <strong>Top-up: ₹{amount:.2f}</strong>
  New balance: ₹{new_balance:.2f}
</div>
<p>You can use this balance to send WhatsApp, Email, and SMS notifications to your patients.</p>
<a href="https://app.molarplus.com/admin/notifications" class="btn">View Wallet →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Wallet topped up: ₹{amount:.2f} added",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_wallet_low(owner_name: str, clinic_name: str, current_balance: float) -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>⚠️ The notification wallet balance for <strong>{clinic_name}</strong> is critically low.</p>
<div class="info-box" style="border-left-color:#ef4444;background:#fff5f5;">
  <strong style="color:#dc2626;">Current balance: ₹{current_balance:.2f}</strong>
  Notifications to your patients may fail until the wallet is recharged.
</div>
<p>Please top up your wallet to continue sending appointment reminders, invoices, and other important patient communications.</p>
<a href="https://app.molarplus.com/admin/notifications" class="btn" style="background:#ef4444;">Top Up Now →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"⚠️ Low wallet balance — notifications may fail",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


# ─── Clinic → Patient templates ───────────────────────────────────────────────

def patient_appointment_booked(patient_name: str, clinic_name: str, clinic_logo_url: str,
                                 appointment_date: str, appointment_time: str, doctor_name: str = "") -> dict:
    dr_line = f"<p>Your appointment is with <strong>Dr. {doctor_name}</strong>.</p>" if doctor_name else ""
    body = f"""
<p>Dear <strong>{patient_name}</strong>,</p>
<p>Your appointment at <strong>{clinic_name}</strong> has been successfully booked.</p>
<div class="info-box">
  <strong>📅 Appointment Details</strong>
  Date: {appointment_date}<br/>Time: {appointment_time}
</div>
{dr_line}
<p>Please arrive 10 minutes early and carry any previous dental records if applicable.</p>
<p>If you need to reschedule, please contact us as soon as possible.</p>
<hr class="divider"/>
<p style="font-size:13px;color:#6b7280;">We look forward to seeing you!</p>"""
    return {
        "subject": f"Appointment booked at {clinic_name} — {appointment_date}",
        "html": _base_wrapper(_clinic_header(clinic_name, clinic_logo_url), body, _clinic_footer(clinic_name)),
    }


def patient_appointment_confirmed(patient_name: str, clinic_name: str, clinic_logo_url: str,
                                   appointment_date: str, appointment_time: str, doctor_name: str = "") -> dict:
    dr_line = f"<p>You will be seen by <strong>Dr. {doctor_name}</strong>.</p>" if doctor_name else ""
    body = f"""
<p>Dear <strong>{patient_name}</strong>,</p>
<p>✅ Your appointment at <strong>{clinic_name}</strong> is <strong>confirmed</strong>.</p>
<div class="info-box">
  <strong>📅 Confirmed Appointment</strong>
  Date: {appointment_date}<br/>Time: {appointment_time}
</div>
{dr_line}
<p>Please arrive 10 minutes before your scheduled time. Don't forget to bring any relevant medical documents.</p>"""
    return {
        "subject": f"Appointment confirmed — {appointment_date} at {appointment_time}",
        "html": _base_wrapper(_clinic_header(clinic_name, clinic_logo_url), body, _clinic_footer(clinic_name)),
    }


def patient_checked_in(patient_name: str, clinic_name: str, clinic_logo_url: str,
                        doctor_name: str = "") -> dict:
    dr_line = f"<strong>Dr. {doctor_name}</strong> will be with you shortly." if doctor_name else "A doctor will be with you shortly."
    body = f"""
<p>Dear <strong>{patient_name}</strong>,</p>
<p>You have been successfully checked in at <strong>{clinic_name}</strong>. 🏥</p>
<div class="info-box">
  <strong>Check-in confirmed</strong>
  {dr_line}
</div>
<p>Please take a seat in the waiting area. If you have any concerns, please let the reception team know.</p>"""
    return {
        "subject": f"You're checked in at {clinic_name}",
        "html": _base_wrapper(_clinic_header(clinic_name, clinic_logo_url), body, _clinic_footer(clinic_name)),
    }


def patient_appointment_reminder(patient_name: str, clinic_name: str, clinic_logo_url: str,
                                   appointment_date: str, appointment_time: str, doctor_name: str = "") -> dict:
    dr_line = f"<p>Your appointment is with <strong>Dr. {doctor_name}</strong>.</p>" if doctor_name else ""
    body = f"""
<p>Dear <strong>{patient_name}</strong>,</p>
<p>⏰ This is a friendly reminder about your upcoming appointment at <strong>{clinic_name}</strong>.</p>
<div class="info-box">
  <strong>📅 Upcoming Appointment</strong>
  Date: {appointment_date}<br/>Time: {appointment_time}
</div>
{dr_line}
<p>Please arrive 10 minutes early. If you need to cancel or reschedule, please contact us at least 24 hours in advance.</p>"""
    return {
        "subject": f"Reminder: Your appointment at {clinic_name} — {appointment_date}",
        "html": _base_wrapper(_clinic_header(clinic_name, clinic_logo_url), body, _clinic_footer(clinic_name)),
    }


def patient_invoice_sent(patient_name: str, clinic_name: str, clinic_logo_url: str,
                          invoice_number: str, total_amount: float, treatment: str = "") -> dict:
    treat_line = f"<p>Treatment: <strong>{treatment}</strong></p>" if treatment else ""
    body = f"""
<p>Dear <strong>{patient_name}</strong>,</p>
<p>Please find your invoice from <strong>{clinic_name}</strong> attached to this email.</p>
<div class="info-box">
  <strong>🧾 Invoice {invoice_number}</strong>
  Total Amount: <strong>₹{total_amount:,.2f}</strong>
  {treat_line}
</div>
<p>If you have any questions about this invoice, please contact us and we'll be happy to assist.</p>
<p style="font-size:13px;color:#6b7280;">Thank you for choosing {clinic_name}.</p>"""
    return {
        "subject": f"Your invoice from {clinic_name} — {invoice_number}",
        "html": _base_wrapper(_clinic_header(clinic_name, clinic_logo_url), body, _clinic_footer(clinic_name)),
    }


def patient_prescription_sent(patient_name: str, clinic_name: str, clinic_logo_url: str,
                                doctor_name: str = "", prescription_date: str = "") -> dict:
    dr_line = f"Prescribed by <strong>Dr. {doctor_name}</strong>" if doctor_name else ""
    date_line = f" on {prescription_date}" if prescription_date else ""
    body = f"""
<p>Dear <strong>{patient_name}</strong>,</p>
<p>Your prescription from <strong>{clinic_name}</strong> is attached to this email.</p>
<div class="info-box">
  <strong>💊 Prescription Details</strong>
  {dr_line}{date_line}
</div>
<p>Please follow the medication instructions carefully. If you experience any adverse reactions, contact your doctor immediately or visit the nearest emergency service.</p>
<p><strong>Important:</strong> Take medications as prescribed and complete the full course even if you feel better.</p>"""
    return {
        "subject": f"Your prescription from {clinic_name}",
        "html": _base_wrapper(_clinic_header(clinic_name, clinic_logo_url), body, _clinic_footer(clinic_name)),
    }


def patient_consent_form(patient_name: str, clinic_name: str, clinic_logo_url: str,
                          consent_link: str, procedure_name: str = "") -> dict:
    proc_line = f" for <strong>{procedure_name}</strong>" if procedure_name else ""
    body = f"""
<p>Dear <strong>{patient_name}</strong>,</p>
<p>Please review and sign your consent form{proc_line} for your upcoming visit to <strong>{clinic_name}</strong>.</p>
<div class="info-box">
  <strong>📋 Action Required</strong>
  Please complete this before your appointment to avoid delays.
</div>
<a href="{consent_link}" class="btn">Review &amp; Sign Consent Form →</a>
<p style="font-size:13px;color:#9ca3af;margin-top:8px;">Or copy this link: <br/>{consent_link}</p>
<p>If you have any questions about the procedure, please don't hesitate to ask your doctor.</p>"""
    return {
        "subject": f"Action required: Consent form from {clinic_name}",
        "html": _base_wrapper(_clinic_header(clinic_name, clinic_logo_url), body, _clinic_footer(clinic_name)),
    }


def patient_google_review(patient_name: str, clinic_name: str, clinic_logo_url: str,
                            review_link: str) -> dict:
    body = f"""
<p>Dear <strong>{patient_name}</strong>,</p>
<p>Thank you for visiting <strong>{clinic_name}</strong>! 😊 We hope your experience was great.</p>
<p>We'd love to hear your feedback. Your review helps us improve and helps other patients find quality dental care.</p>
<a href="{review_link}" class="btn">⭐ Leave a Google Review →</a>
<p style="font-size:13px;color:#9ca3af;margin-top:8px;">It only takes 30 seconds!</p>
<p>Thank you for trusting us with your dental health.</p>"""
    return {
        "subject": f"How was your visit at {clinic_name}? Share your experience ⭐",
        "html": _base_wrapper(_clinic_header(clinic_name, clinic_logo_url), body, _clinic_footer(clinic_name)),
    }


# ─── Dispatcher ───────────────────────────────────────────────────────────────

PLATFORM_EVENTS = {
    "welcome", "branch_added", "subscription_purchased", "wallet_topup", "wallet_low"
}

PATIENT_EVENTS = {
    "appointment_booked", "appointment_confirmation", "checked_in",
    "appointment_reminder", "invoice_notification", "prescription_notification",
    "consent_form", "google_review",
}

def build_email(event_type: str, **kwargs) -> dict:
    """
    Build subject + html for any event_type.
    kwargs must contain all fields required by the individual builder.
    Returns {"subject": str, "html": str} or raises ValueError.
    """
    builders = {
        "welcome":                    platform_welcome,
        "branch_added":               platform_branch_added,
        "subscription_purchased":     platform_subscription_purchased,
        "wallet_topup":               platform_wallet_topup,
        "wallet_low":                 platform_wallet_low,
        "appointment_booked":         patient_appointment_booked,
        "appointment_confirmation":   patient_appointment_confirmed,
        "checked_in":                 patient_checked_in,
        "appointment_reminder":       patient_appointment_reminder,
        "invoice_notification":       patient_invoice_sent,
        "prescription_notification":  patient_prescription_sent,
        "consent_form":               patient_consent_form,
        "google_review":              patient_google_review,
    }
    fn = builders.get(event_type)
    if not fn:
        raise ValueError(f"Unknown event_type: {event_type}")
    return fn(**kwargs)
