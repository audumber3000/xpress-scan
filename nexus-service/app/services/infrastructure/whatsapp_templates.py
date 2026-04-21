"""
WhatsApp template component builders for all clinic→patient notification events.

How it works:
  - You create ONE generic template per event in Meta Business Manager.
  - Each template has a header (text/image), body (with {{1}}, {{2}}… parameters), and footer.
  - This file maps event_type → (template_name, language, components[]).
  - Template names and parameter order must match what you registered in Meta.

Configuration (via .env):
  WA_TPL_APPOINTMENT_BOOKED       = mp_appointment_booked
  WA_TPL_APPOINTMENT_CONFIRMED    = mp_appointment_confirmed
  WA_TPL_CHECKED_IN               = mp_checked_in
  WA_TPL_APPOINTMENT_REMINDER     = mp_appointment_reminder
  WA_TPL_INVOICE                  = mp_invoice_sent
  WA_TPL_PRESCRIPTION             = mp_prescription_sent
  WA_TPL_CONSENT_FORM             = mp_consent_form
  WA_TPL_GOOGLE_REVIEW            = mp_google_review
  WA_TPL_DAILY_SUMMARY            = mp_daily_summary

Footer on all templates (set in Meta dashboard):
  "Powered by MolarPlus"

Body parameter order is documented per function below.
"""

import os

SUPPORT_PHONE = "+91 9594078777"
SUPPORT_EMAIL = "support@molarplus.com"

# ── Footer text to set in Meta Business Manager ────────────────────────────────
# Clinic → Patient templates (all 8 below):
PATIENT_FOOTER = "Powered By MolarPlus | www.molarplus.com"
#
# Platform → Doctor/Clinic Owner templates (future):
DOCTOR_FOOTER  = "For support: WhatsApp +91 9594078777 | support@molarplus.com · Powered by MolarPlus"
# ──────────────────────────────────────────────────────────────────────────────


def _get_tpl(env_key: str, default: str) -> str:
    return os.getenv(env_key, default)


def _body_params(*values) -> dict:
    return {
        "type": "body",
        "parameters": [{"type": "text", "text": str(v)} for v in values],
    }


def _header_text(clinic_name: str) -> dict:
    return {
        "type": "header",
        "parameters": [{"type": "text", "text": clinic_name}],
    }


def _header_document(document_url: str = "", filename: str = "document.pdf",
                     media_id: str = "") -> dict:
    doc = {"filename": filename}
    if media_id:
        doc["id"] = media_id
    else:
        doc["link"] = document_url
    return {
        "type": "header",
        "parameters": [{"type": "document", "document": doc}],
    }


def _footer_component() -> dict:
    """
    Recommended footer for every Meta WhatsApp template.
    Add this to the components list when sending to doctors / clinic owners.
    NOTE: The footer TEXT itself must match exactly what was approved in Meta dashboard.
    """
    return {
        "type": "footer",
        "parameters": [],
    }


# ─── Template builders ────────────────────────────────────────────────────────

def wa_appointment_booked(patient_name: str, clinic_name: str,
                           appointment_date: str, appointment_time: str,
                           clinic_phone: str = "", doctor_name: str = "") -> dict:
    """
    Body params: {{1}} patient_name, {{2}} clinic_name,
                 {{3}} appointment_date, {{4}} appointment_time, {{5}} clinic_phone
    End of template text: reuse {{2}} for clinic name + {{5}} for phone
    """
    tpl = _get_tpl("WA_TPL_APPOINTMENT_BOOKED", "mp_appointment_booked_v2")
    return {
        "template_name": tpl,
        "components": [_body_params(patient_name, clinic_name, appointment_date, appointment_time, clinic_phone)],
    }


def wa_appointment_confirmed(patient_name: str, clinic_name: str,
                              appointment_date: str, appointment_time: str,
                              clinic_phone: str = "") -> dict:
    """
    Body params: {{1}} patient_name, {{2}} clinic_name,
                 {{3}} appointment_date, {{4}} appointment_time, {{5}} clinic_phone
    End of template text: reuse {{2}} for clinic name + {{5}} for phone
    """
    tpl = _get_tpl("WA_TPL_APPOINTMENT_CONFIRMED", "mp_appointment_confirmed")
    return {
        "template_name": tpl,
        "components": [_body_params(patient_name, clinic_name, appointment_date, appointment_time, clinic_phone)],
    }


def wa_checked_in(patient_name: str, clinic_name: str, doctor_name: str = "",
                  clinic_phone: str = "") -> dict:
    """
    Body params: {{1}} patient_name, {{2}} clinic_name,
                 {{3}} doctor_name_or_blank, {{4}} clinic_phone
    End of template text: reuse {{2}} for clinic name + {{4}} for phone
    """
    tpl = _get_tpl("WA_TPL_CHECKED_IN", "mp_checked_in")
    return {
        "template_name": tpl,
        "components": [_header_text(clinic_name), _body_params(patient_name, clinic_name, doctor_name or "our team", clinic_phone)],
    }


def wa_appointment_reminder(patient_name: str, clinic_name: str,
                             appointment_date: str, appointment_time: str,
                             clinic_phone: str = "") -> dict:
    """
    Body params: {{1}} patient_name, {{2}} clinic_name,
                 {{3}} appointment_date, {{4}} appointment_time, {{5}} clinic_phone
    End of template text: reuse {{2}} for clinic name + {{5}} for phone
    """
    tpl = _get_tpl("WA_TPL_APPOINTMENT_REMINDER", "mp_appointment_reminder")
    return {
        "template_name": tpl,
        "components": [_body_params(patient_name, clinic_name, appointment_date, appointment_time, clinic_phone)],
    }


def wa_invoice_sent(patient_name: str, clinic_name: str,
                    invoice_number: str, total_amount: float,
                    clinic_phone: str = "", document_url: str = "",
                    media_id: str = "") -> dict:
    """
    Header: document (PDF invoice) — pass media_id (preferred) or document_url.
    Body params: {{1}} patient_name, {{2}} clinic_name,
                 {{3}} invoice_number, {{4}} total_amount, {{5}} clinic_phone
    """
    tpl = _get_tpl("WA_TPL_INVOICE", "mp_invoice_sent")
    components = [_body_params(patient_name, clinic_name, invoice_number, f"₹{total_amount:,.2f}", clinic_phone)]
    if media_id or document_url:
        components.insert(0, _header_document(document_url, f"Invoice_{invoice_number}.pdf", media_id))
    return {
        "template_name": tpl,
        "components": components,
    }


def wa_prescription_sent(patient_name: str, clinic_name: str, doctor_name: str = "",
                         clinic_phone: str = "", document_url: str = "",
                         media_id: str = "") -> dict:
    """
    Header: document (PDF prescription) — pass media_id (preferred) or document_url.
    Body params: {{1}} patient_name, {{2}} clinic_name,
                 {{3}} doctor_name, {{4}} clinic_phone
    """
    tpl = _get_tpl("WA_TPL_PRESCRIPTION", "mp_prescription_sent")
    components = [_body_params(patient_name, clinic_name, doctor_name or "your doctor", clinic_phone)]
    if media_id or document_url:
        components.insert(0, _header_document(document_url, "Prescription.pdf", media_id))
    return {
        "template_name": tpl,
        "components": components,
    }


def wa_consent_form(patient_name: str, clinic_name: str, consent_link: str,
                    procedure_name: str = "", clinic_phone: str = "") -> dict:
    """
    Body params: {{1}} patient_name, {{2}} clinic_name,
                 {{3}} procedure_name, {{4}} consent_link, {{5}} clinic_phone
    End of template text: reuse {{2}} for clinic name + {{5}} for phone
    """
    tpl = _get_tpl("WA_TPL_CONSENT_FORM", "mp_consent_form")
    return {
        "template_name": tpl,
        "components": [_body_params(patient_name, clinic_name, procedure_name or "your procedure", consent_link, clinic_phone)],
    }


def wa_google_review(patient_name: str, clinic_name: str, review_link: str,
                     clinic_phone: str = "") -> dict:
    """
    Body params: {{1}} patient_name, {{2}} clinic_name,
                 {{3}} review_link, {{4}} clinic_phone
    End of template text: reuse {{2}} for clinic name + {{4}} for phone
    """
    tpl = _get_tpl("WA_TPL_GOOGLE_REVIEW", "mp_google_review")
    return {
        "template_name": tpl,
        "components": [_body_params(patient_name, clinic_name, review_link, clinic_phone)],
    }


def wa_daily_summary(doctor_name: str, clinic_name: str, date: str, 
                     total_patients: int, total_appointments: int,
                     total_revenue: float, cash_revenue: float, online_revenue: float) -> dict:
    """
    Body params: {{1}} doctor_name, {{2}} clinic_name, {{3}} date,
                 {{4}} total_patients, {{5}} total_appointments,
                 {{6}} total_revenue, {{7}} cash_revenue, {{8}} online_revenue
    """
    tpl = _get_tpl("WA_TPL_DAILY_SUMMARY", "mp_daily_summary")
    return {
        "template_name": tpl,
        "components": [
            _header_text("Daily Summary"), 
            _body_params(
                doctor_name, 
                clinic_name, 
                date, 
                str(total_patients), 
                str(total_appointments), 
                f"₹{total_revenue:,.2f}", 
                f"₹{cash_revenue:,.2f}", 
                f"₹{online_revenue:,.2f}"
            )
        ],
    }


def wa_passthrough_template(template_name: str, *values) -> dict:
    """Build a passthrough template with optional ordered body params."""
    components = [_body_params(*values)] if values else []
    return {
        "template_name": template_name,
        "components": components,
    }


# ─── Dispatcher ───────────────────────────────────────────────────────────────

def build_whatsapp(event_type: str, **kwargs) -> dict:
    """
    Returns {"template_name": str, "components": list} or raises ValueError.
    Pass all fields required by the individual builder as kwargs.
    """
    builders = {
        "appointment_booked":        wa_appointment_booked,
        "appointment_confirmation":  wa_appointment_confirmed,
        "checked_in":                wa_checked_in,
        "appointment_reminder":      wa_appointment_reminder,
        "invoice_notification":      wa_invoice_sent,
        "prescription_notification": wa_prescription_sent,
        "consent_form":              wa_consent_form,
        "google_review":             wa_google_review,
        "daily_summary":             wa_daily_summary,
        "molarplus_app_welcome":     lambda **kw: {
            "template_name": "molarplus_app_welcome",
            "components": [_header_text(kw.get("owner_name", ""))],  # {{1}} in header only, 0 body
        },
        # T2: header {{1}}=owner, body {{1}}=plan {{2}}=valid_until
        "molarplus_subscription_confirmed": lambda **kw: {
            "template_name": "molarplus_subscription_confirmed",
            "components": [
                _header_text(kw.get("owner_name", "")),
                _body_params(kw.get("plan_name", ""), kw.get("valid_until", "")),
            ],
        },
        # T3: header {{1}}=owner, body {{1}}=amount {{2}}=new_balance
        "molarplus_topup_success":   lambda **kw: {
            "template_name": "molarplus_topup_success",
            "components": [
                _header_text(kw.get("owner_name", "")),
                _body_params(kw.get("amount", ""), kw.get("new_balance", "")),
            ],
        },
        # T4: header {{1}}=owner_name, body {{1}}=lab {{2}}=order_date {{3}}=patient
        "molarplus_lab_due_tomorrow_mk": lambda **kw: {
            "template_name": "molarplus_lab_due_tomorrow",
            "components": [
                _header_text(kw.get("owner_name", "")),
                _body_params(kw.get("lab_name", ""), kw.get("order_date", ""), kw.get("patient_name", "")),
            ],
        },
        # T5: header {{1}}=week_date, body 8 params
        "molarplus_weekly_report_mk": lambda **kw: {
            "template_name": "molarplus_weekly_report_mk",
            "components": [
                _header_text(kw.get("week_date", "")),
                _body_params(
                    kw.get("appointments", ""), kw.get("appt_change", ""),
                    kw.get("new_patients", ""), kw.get("patients_change", ""),
                    kw.get("revenue", ""), kw.get("revenue_change", ""),
                    kw.get("noshows", ""), kw.get("insight", ""),
                ),
            ],
        },
        # T6: header {{1}}=month, body 9 params
        "molarplus_monthly_report_mk": lambda **kw: {
            "template_name": "molarplus_monthly_report_mk",
            "components": [
                _header_text(kw.get("month", "")),
                _body_params(
                    kw.get("total_patients", ""), kw.get("new_patients", ""),
                    kw.get("returning_patients", ""), kw.get("total_revenue", ""),
                    kw.get("avg_revenue", ""), kw.get("change", ""),
                    kw.get("top_treatments", ""), kw.get("noshows", ""),
                    kw.get("noshows_pct", ""),
                ),
            ],
        },
        # T7: header {{1}}=month, body 6 params
        "molarplus_review_report_mk": lambda **kw: {
            "template_name": "molarplus_review_report_mk",
            "components": [
                _header_text(kw.get("month", "")),
                _body_params(
                    kw.get("rating", ""), kw.get("new_reviews", ""),
                    kw.get("change", ""), kw.get("loved1", ""),
                    kw.get("loved2", ""), kw.get("area_to_watch", ""),
                ),
            ],
        },
        # F1: header {{1}}=owner_name, body 0 params
        "molarplus_trial_started_mk": lambda **kw: {
            "template_name": "molarplus_trial_started_mk",
            "components": [_header_text(kw.get("owner_name", ""))],
        },
        # F2: header {{1}}=owner_name, body 0 params
        "molarplus_trial_mid_mk":    lambda **kw: {
            "template_name": "molarplus_trial_mid_mk",
            "components": [_header_text(kw.get("owner_name", ""))],
        },
        # F3: header {{1}}=owner_name, body {{1}}=price
        "molarplus_trial_ending_mk": lambda **kw: {
            "template_name": "molarplus_trial_ending_mk",
            "components": [
                _header_text(kw.get("owner_name", "")),
                _body_params(kw.get("price", "999")),
            ],
        },
        # F4: header {{1}}=owner_name, body 0 params
        "molarplus_trial_ended_mk":  lambda **kw: {
            "template_name": "molarplus_trial_ended_mk",
            "components": [_header_text(kw.get("owner_name", ""))],
        },
    }
    fn = builders.get(event_type)
    if not fn:
        raise ValueError(f"No WhatsApp template for event_type: {event_type}")
    return fn(**kwargs)
