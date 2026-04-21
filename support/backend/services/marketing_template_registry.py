from typing import Dict, List


BULK_WHATSAPP_TEMPLATES: List[Dict[str, str]] = [
    {
        "name": "molarplus_freshgrad_mk",
        "category": "marketing",
        "label": "Fresh grad / new clinic",
        "description": "Bulk marketing template for fresh graduates or newly opened clinics.",
    },
    {
        "name": "molarplus_experienced_mk",
        "category": "marketing",
        "label": "Already practicing",
        "description": "Bulk marketing template for experienced practitioners.",
    },
    {
        "name": "molarplus_noshows_mk",
        "category": "marketing",
        "label": "No-show pain point",
        "description": "Bulk marketing template focused on appointment no-shows.",
    },
    {
        "name": "molarplus_admin_mk",
        "category": "marketing",
        "label": "Admin/paperwork pain point",
        "description": "Bulk marketing template focused on admin and paperwork pain points.",
    },
    {
        "name": "molarplus_revenue_mk",
        "category": "marketing",
        "label": "Revenue tracking pain point",
        "description": "Bulk marketing template focused on revenue visibility and tracking.",
    },
    {
        "name": "molarplus_promo_mk",
        "category": "marketing",
        "label": "General awareness / promo",
        "description": "Bulk marketing template for general awareness and promotions.",
    },
]


_BULK_TEMPLATE_INDEX = {template["name"]: template for template in BULK_WHATSAPP_TEMPLATES}


def list_bulk_whatsapp_templates() -> List[Dict[str, str]]:
    return BULK_WHATSAPP_TEMPLATES


def get_bulk_whatsapp_template(template_name: str) -> Dict[str, str] | None:
    return _BULK_TEMPLATE_INDEX.get(template_name)
