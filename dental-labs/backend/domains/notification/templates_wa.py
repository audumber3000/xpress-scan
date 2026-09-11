"""
WhatsApp template builders for Dental Labs events.

Maps event_type -> {"template_name", "components"} in the Meta component shape
(translated to MSG91 by NotificationService.send_whatsapp).

The recipient is always the lab's CLIENT (the dentist/clinic). Template names
default to `dl_*` and are overridable via env so they can be matched to whatever
was approved in MSG91/Meta without a code change.

⚠️  Each template must be APPROVED in MSG91/Meta with a matching parameter count
before WhatsApp sends will succeed. Until then sends are logged `failed`.
"""
import os

# Body parameter order per template (kept here so the approved Meta template and
# this code stay in sync — see the docstring on each builder).


def _tpl(env_key: str, default: str) -> str:
    return os.getenv(env_key, default)


def _body_params(*values) -> dict:
    return {
        "type": "body",
        "parameters": [{"type": "text", "text": str(v)} for v in values],
    }


def _header_document(document_url: str = "", filename: str = "document.pdf") -> dict:
    return {
        "type": "header",
        "parameters": [{"type": "document", "document": {"link": document_url, "filename": filename}}],
    }


# ─── Builders ─────────────────────────────────────────────────────────────────

def wa_case_received(client_name, lab_name, case_number, patient_name, lab_phone="", **_):
    """Body: {{1}} doctor, {{2}} lab, {{3}} case_no, {{4}} patient, {{5}} lab_phone"""
    return {
        "template_name": _tpl("WA_TPL_CASE_RECEIVED", "dl_case_received"),
        "components": [_body_params(client_name, lab_name, case_number, patient_name or "—", lab_phone)],
    }


def wa_case_dispatched(client_name, lab_name, case_number, patient_name, lab_phone="", **_):
    """Body: {{1}} doctor, {{2}} lab, {{3}} case_no, {{4}} patient, {{5}} lab_phone"""
    return {
        "template_name": _tpl("WA_TPL_CASE_DISPATCHED", "dl_case_dispatched"),
        "components": [_body_params(client_name, lab_name, case_number, patient_name or "—", lab_phone)],
    }


def wa_case_delivered(client_name, lab_name, case_number, patient_name, lab_phone="", **_):
    """Body: {{1}} doctor, {{2}} lab, {{3}} case_no, {{4}} patient, {{5}} lab_phone"""
    return {
        "template_name": _tpl("WA_TPL_CASE_DELIVERED", "dl_case_delivered"),
        "components": [_body_params(client_name, lab_name, case_number, patient_name or "—", lab_phone)],
    }


def wa_statement_ready(client_name, lab_name, period_label, amount, lab_phone="",
                       statement_url="", **_):
    """Header: statement PDF. Body: {{1}} doctor, {{2}} lab, {{3}} period, {{4}} amount, {{5}} lab_phone"""
    components = [_body_params(client_name, lab_name, period_label, amount, lab_phone)]
    if statement_url:
        components.insert(0, _header_document(statement_url, "Statement.pdf"))
    return {
        "template_name": _tpl("WA_TPL_STATEMENT_READY", "dl_statement_ready"),
        "components": components,
    }


_BUILDERS = {
    "case_received": wa_case_received,
    "case_dispatched": wa_case_dispatched,
    "case_delivered": wa_case_delivered,
    "statement_ready": wa_statement_ready,
}


def build_whatsapp(event_type: str, **kwargs) -> dict:
    """Return {"template_name", "components"} for the event, or raise ValueError."""
    builder = _BUILDERS.get(event_type)
    if not builder:
        raise ValueError(f"No WhatsApp template for event '{event_type}'")
    return builder(**kwargs)
