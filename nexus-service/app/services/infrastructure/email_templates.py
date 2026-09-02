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


def platform_app_welcome(owner_name: str = "there", clinic_name: str = "your clinic") -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Welcome to <strong>MolarPlus</strong>. Your clinic <strong>{clinic_name}</strong> is ready to go.</p>
<p>You can now start setting up your workflows, team, and patient communication.</p>
<a href="https://app.molarplus.com/dashboard" class="btn">Open MolarPlus →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Welcome to MolarPlus, {owner_name}",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_subscription_confirmed(owner_name: str = "there", clinic_name: str = "your clinic", plan_name: str = "Professional", valid_until: str = "") -> dict:
    validity = f"Valid until: {valid_until}" if valid_until else "Your plan is now active."
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Your subscription for <strong>{clinic_name}</strong> has been confirmed successfully.</p>
<div class="info-box">
  <strong>{plan_name}</strong>
  {validity}
</div>
<p>Thank you for upgrading with MolarPlus.</p>
<a href="https://app.molarplus.com/admin/subscription" class="btn">View Subscription →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Subscription confirmed for {clinic_name}",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_topup_success(owner_name: str = "there", clinic_name: str = "your clinic", amount: str = "", new_balance: str = "") -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Your MolarPlus wallet top-up for <strong>{clinic_name}</strong> was successful.</p>
<div class="info-box">
  <strong>Top-up successful</strong>
  Amount added: ₹{amount or "0.00"}<br/>New balance: ₹{new_balance or "0.00"}
</div>
<a href="https://app.molarplus.com/admin/notifications" class="btn">View Wallet →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Wallet top-up successful for {clinic_name}",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_lab_due_tomorrow(owner_name: str = "there", clinic_name: str = "your clinic", due_date: str = "tomorrow", work_type: str = "lab work") -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>This is a reminder that a lab order for <strong>{clinic_name}</strong> is due on <strong>{due_date}</strong>.</p>
<div class="info-box">
  <strong>Upcoming due item</strong>
  Work type: {work_type}
</div>
<p>Please review your lab queue to avoid delays.</p>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Lab order due tomorrow for {clinic_name}",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_weekly_report(owner_name: str = "there", clinic_name: str = "your clinic") -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Your weekly MolarPlus business snapshot for <strong>{clinic_name}</strong> is ready.</p>
<p>Open the dashboard to review appointments, collections, and team activity for the last 7 days.</p>
<a href="https://app.molarplus.com/reports" class="btn">Review Weekly Report →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Your weekly MolarPlus report is ready",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_monthly_report(owner_name: str = "there", clinic_name: str = "your clinic") -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Your monthly performance summary for <strong>{clinic_name}</strong> is now available in MolarPlus.</p>
<a href="https://app.molarplus.com/reports" class="btn">Open Monthly Report →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Monthly MolarPlus report for {clinic_name}",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_review_report(owner_name: str = "there", clinic_name: str = "your clinic") -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>Your review and reputation summary for <strong>{clinic_name}</strong> is ready.</p>
<p>Check your recent patient feedback and overall review momentum inside MolarPlus.</p>
<a href="https://app.molarplus.com/reports" class="btn">Open Review Insights →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"Review insights ready for {clinic_name}",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_trial_message(subject: str, headline: str, owner_name: str = "there", clinic_name: str = "your clinic") -> dict:
    body = f"""
<p>Hi <strong>{owner_name}</strong>,</p>
<p>{headline} for <strong>{clinic_name}</strong>.</p>
<a href="https://app.molarplus.com/subscription" class="btn">Open MolarPlus →</a>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": subject,
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_otp_verification(otp: str = "", code: str = "", clinic_name: str = "your clinic",
                              expires_in_minutes: int = 10, **_) -> dict:
    """
    Verification code for the clinic's recovery email (Control Center > Security).

    Deliberately a PLATFORM email: it comes from MolarPlus, not from the clinic,
    and it goes to the owner rather than a patient. Accepts either `otp` or
    `code` because the two names are both in use by callers.
    """
    the_code = str(otp or code or "")
    body = f"""
<p>Hi,</p>
<p>Here is your verification code for <strong>{clinic_name}</strong>.</p>
<div class="info-box" style="text-align:center;">
  <strong style="font-size:30px;letter-spacing:8px;color:{BRAND_COLOR};">{the_code}</strong>
</div>
<p>It expires in {expires_in_minutes} minutes. If you did not ask to verify this
address, you can safely ignore this email and nothing will change.</p>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"{the_code} is your MolarPlus verification code",
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
                          invoice_number: str, total_amount: float, treatment: str = "",
                          currency: str = "₹", **_) -> dict:
    treat_line = f"<p>Treatment: <strong>{treatment}</strong></p>" if treatment else ""
    body = f"""
<p>Dear <strong>{patient_name}</strong>,</p>
<p>Please find your invoice from <strong>{clinic_name}</strong> attached to this email.</p>
<div class="info-box">
  <strong>🧾 Invoice {invoice_number}</strong>
  Total Amount: <strong>{currency}{total_amount:,.2f}</strong>
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


def vendor_lab_order_placed(clinic_name: str, clinic_logo_url: str = "",
                             lab_name: str = "", work_type: str = "",
                             patient_name: str = "", tooth_number: str = "",
                             shade: str = "", due_date: str = "",
                             instructions: str = "", clinic_phone: str = "") -> dict:
    """Clinic → dental lab: a new work order was placed.

    Clinic-branded (not platform-branded) because the lab is the clinic's
    supplier, not a MolarPlus customer.
    """
    rows = [("Work", work_type), ("Patient", patient_name), ("Tooth", tooth_number),
            ("Shade", shade), ("Due", due_date)]
    detail_lines = "".join(
        f"<div>{label}: <strong>{value}</strong></div>"
        for label, value in rows if value
    )
    notes = (
        f'<p>Instructions:<br /><em>{instructions}</em></p>' if instructions else ""
    )
    contact = (
        f'<p style="font-size:13px;color:#6b7280;">Questions about this order? Call us on {clinic_phone}.</p>'
        if clinic_phone else ""
    )
    greeting = f"Dear <strong>{lab_name}</strong>," if lab_name else "Hello,"
    body = f"""
<p>{greeting}</p>
<p><strong>{clinic_name}</strong> has placed a new lab work order.</p>
<div class="info-box">
  <strong>🦷 New Work Order</strong>
  {detail_lines}
</div>
{notes}
{contact}"""
    subject_bits = " — ".join(b for b in [work_type, patient_name] if b)
    return {
        "subject": f"New lab order from {clinic_name}" + (f": {subject_bits}" if subject_bits else ""),
        "html": _base_wrapper(_clinic_header(clinic_name, clinic_logo_url), body, _clinic_footer(clinic_name)),
    }


def platform_password_reset(reset_url: str = "", user_name: str = "",
                            expires_in_minutes: int = 60, **_) -> dict:
    """A link to set a new MolarPlus password.

    Lives here, in Nexus, because Nexus is the only thing in this system that
    can actually send email. The backend has no mail provider of its own in
    production: no ZOHO_* variables reach that container, so the EmailService
    call the forgot-password route used to make could only ever fail, and it
    failed silently. Every customer who asked for a reset link was told one was
    on its way and nothing was ever sent.

    A PLATFORM email, like otp_verification above: it comes from MolarPlus
    rather than from the clinic, and it goes to the account holder rather than
    to a patient. That also puts it on the authenticated molarplus.com sender
    instead of an unrelated domain, which is the difference between the inbox
    and the spam folder.
    """
    greeting = f"Hi <strong>{user_name}</strong>," if user_name else "Hi,"
    body = f"""
<p>{greeting}</p>
<p>We received a request to set a new password for your <strong>MolarPlus</strong> account.
   Use the button below to choose one.</p>
<a href="{reset_url}" class="btn">Set a new password &rarr;</a>
<p style="font-size:13px;color:#6b7280;margin-top:18px;">
  If the button does not work, copy this link into your browser:<br>
  <a href="{reset_url}" style="word-break:break-all;">{reset_url}</a>
</p>
<div class="info-box">
  This link expires in {expires_in_minutes} minutes and can only be used once.
</div>
<p>If you did not ask for this, you can safely ignore this email. Your password
   will not change and nobody else can use the link.</p>"""
    body += _SUPPORT_BLOCK
    return {
        "subject": "Reset your MolarPlus password",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


def platform_staff_invitation(staff_name: str = "", clinic_name: str = "your clinic",
                              role: str = "", inviter_name: str = "", login_id: str = "",
                              password: str = "", login_url: str = "", **_) -> dict:
    """The account details a new staff member needs to sign in for the first time.

    A PLATFORM email for the same reason otp_verification is: the credentials in
    it are MolarPlus credentials and the link goes to the MolarPlus app, so it
    should arrive from MolarPlus rather than wearing the clinic's branding as if
    the clinic had sent it. The clinic is named throughout the body, which is
    what the reader actually needs to recognise it.

    Moved here from the backend's EmailService, which could never send it: no
    ZOHO_* variables reach the backend container in production, so every staff
    invitation since that code was written failed on the first line and was
    logged as a warning. Nobody has ever received one.

    The password is included when the caller supplies it, matching the existing
    behaviour. That is a real trade: a password sitting in an inbox forever is a
    standing risk, which is why the sign-in prompt below tells them to change it.
    """
    inviter_text = f" by {inviter_name}" if inviter_name else ""
    role_text = (role or "team member").replace("_", " ")

    if login_id:
        password_row = (
            f'<p style="margin:4px 0;"><strong>Password:</strong> '
            f'<code style="background:#fff;padding:2px 6px;border-radius:4px;">{password}</code></p>'
            if password else
            '<p style="margin:4px 0;">Your password has been shared with you separately.</p>'
        )
        credentials = f"""
<div class="info-box">
  <p style="margin:4px 0;"><strong>Login ID:</strong> {login_id}</p>
  {password_row}
  <p style="margin:4px 0;"><strong>Role:</strong> {role_text}</p>
</div>
<p style="font-size:13px;color:#6b7280;">Please change your password once you have signed in.</p>"""
    else:
        credentials = ""

    button = (
        f'<a href="{login_url}" class="btn">Sign in &rarr;</a>'
        if login_url else
        '<a href="https://app.molarplus.com/login" class="btn">Sign in &rarr;</a>'
    )

    greeting = f"Hi <strong>{staff_name}</strong>," if staff_name else "Hi,"
    body = f"""
<p>{greeting}</p>
<p>You have been added to <strong>{clinic_name}</strong> on MolarPlus as a
   <strong>{role_text}</strong>{inviter_text}.</p>
{credentials}
{button}"""
    body += _SUPPORT_BLOCK
    return {
        "subject": f"You have been added to {clinic_name} on MolarPlus",
        "html": _base_wrapper(_platform_header(), body, _platform_footer()),
    }


# ─── Dispatcher ───────────────────────────────────────────────────────────────

PLATFORM_EVENTS = {
    "welcome", "branch_added", "subscription_purchased", "wallet_topup", "wallet_low",
    "molarplus_app_welcome", "molarplus_subscription_confirmed", "molarplus_topup_success",
    "molarplus_lab_due_tomorrow", "molarplus_weekly_report_mk", "molarplus_monthly_report_mk",
    "molarplus_review_report_mk", "molarplus_trial_started_mk", "molarplus_trial_mid_mk",
    "molarplus_trial_ending_mk", "molarplus_trial_ended_mk",
    # Goes to the clinic owner's recovery address, from the platform sender.
    "otp_verification",
    # Same reasoning: from MolarPlus, to the account holder, never to a patient.
    "password_reset",
    "staff_invitation",
}

PATIENT_EVENTS = {
    "appointment_booked", "appointment_confirmation", "checked_in",
    "appointment_reminder", "appointment_reminder_2h",
    "invoice_notification", "prescription_notification",
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
        "molarplus_app_welcome":      platform_app_welcome,
        "password_reset":             platform_password_reset,
        "staff_invitation":           platform_staff_invitation,
        "molarplus_subscription_confirmed": platform_subscription_confirmed,
        "molarplus_topup_success":    platform_topup_success,
        "molarplus_lab_due_tomorrow": platform_lab_due_tomorrow,
        "molarplus_weekly_report_mk": platform_weekly_report,
        "molarplus_monthly_report_mk": platform_monthly_report,
        "molarplus_review_report_mk": platform_review_report,
        "molarplus_trial_started_mk": lambda **kwargs: platform_trial_message(
            "Your MolarPlus trial has started",
            "Your MolarPlus trial has officially started",
            **kwargs,
        ),
        "molarplus_trial_mid_mk": lambda **kwargs: platform_trial_message(
            "Your MolarPlus trial is underway",
            "You are in the middle of your MolarPlus trial",
            **kwargs,
        ),
        "molarplus_trial_ending_mk": lambda **kwargs: platform_trial_message(
            "Your MolarPlus trial is ending soon",
            "Your MolarPlus trial is ending soon",
            **kwargs,
        ),
        "molarplus_trial_ended_mk": lambda **kwargs: platform_trial_message(
            "Your MolarPlus trial has ended",
            "Your MolarPlus trial has ended",
            **kwargs,
        ),
        "otp_verification":           platform_otp_verification,
        "appointment_booked":         patient_appointment_booked,
        "appointment_confirmation":   patient_appointment_confirmed,
        "checked_in":                 patient_checked_in,
        "appointment_reminder":       patient_appointment_reminder,
        # Same email body as the day-before reminder. The two tiers differ
        # in when they are sent, not in what they need to say.
        "appointment_reminder_2h":    patient_appointment_reminder,
        "invoice_notification":       patient_invoice_sent,
        "prescription_notification":  patient_prescription_sent,
        "consent_form":               patient_consent_form,
        "google_review":              patient_google_review,
        "lab_order_placed":           vendor_lab_order_placed,
    }
    fn = builders.get(event_type)
    if not fn:
        raise ValueError(f"Unknown event_type: {event_type}")
    return fn(**kwargs)
