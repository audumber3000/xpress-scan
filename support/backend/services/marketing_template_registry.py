from typing import Any, Dict, List


# Each template entry mirrors what's approved on the MSG91 / Meta side.
# - requires_image: template has an IMAGE header component, so a public URL
#   must be supplied at send time (passed through to MSG91 as header_1).
# - body_params_count: number of {{1}}, {{2}}, ... placeholders in the
#   approved template body. Currently 0 across all six (the marketing
#   creative is fully baked into the template). If a template is later
#   re-approved with body variables, bump this count and add a mapper in
#   marketing.py that fills body_<n> per clinic.
BULK_WHATSAPP_TEMPLATES: List[Dict[str, Any]] = [
    {
        "name": "molarplus_freshgrad_mk",
        "category": "marketing",
        "label": "Fresh grad / new clinic",
        "description": "Bulk marketing template for fresh graduates or newly opened clinics.",
        "requires_image": True,
        "body_params_count": 0,
    },
    {
        "name": "molarplus_experienced_mk",
        "category": "marketing",
        "label": "Already practicing",
        "description": "Bulk marketing template for experienced practitioners.",
        "requires_image": True,
        "body_params_count": 0,
    },
    {
        "name": "molarplus_noshows_mk",
        "category": "marketing",
        "label": "No-show pain point",
        "description": "Bulk marketing template focused on appointment no-shows.",
        "requires_image": True,
        "body_params_count": 0,
    },
    {
        "name": "molarplus_admin_mk",
        "category": "marketing",
        "label": "Admin/paperwork pain point",
        "description": "Bulk marketing template focused on admin and paperwork pain points.",
        "requires_image": True,
        "body_params_count": 0,
    },
    {
        "name": "molarplus_revenue_mk",
        "category": "marketing",
        "label": "Revenue tracking pain point",
        "description": "Bulk marketing template focused on revenue visibility and tracking.",
        "requires_image": True,
        "body_params_count": 0,
    },
    {
        "name": "molarplus_promo_mk",
        "category": "marketing",
        "label": "General awareness / promo",
        "description": "Bulk marketing template for general awareness and promotions.",
        "requires_image": True,
        "body_params_count": 0,
    },
]


_BULK_TEMPLATE_INDEX = {template["name"]: template for template in BULK_WHATSAPP_TEMPLATES}


def list_bulk_whatsapp_templates() -> List[Dict[str, Any]]:
    return BULK_WHATSAPP_TEMPLATES


def get_bulk_whatsapp_template(template_name: str) -> Dict[str, Any] | None:
    return _BULK_TEMPLATE_INDEX.get(template_name)
