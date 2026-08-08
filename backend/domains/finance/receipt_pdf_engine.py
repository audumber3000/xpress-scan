"""Payment receipt engine — thin dispatcher, mirroring `invoice_pdf_engine`.

Rendering lives in `receipt_templates/<variant>.py`. The variant is chosen by
the clinic's *invoice* `template_id`, so the receipt always matches the bill it
belongs to, and unknown / legacy / missing ids fall back to classic.
"""
from domains.finance.receipt_templates import resolve_variant


def generate_receipt_html(invoice, payment, clinic, config=None) -> str:
    template_id = getattr(config, 'template_id', None) if config else None
    variant = resolve_variant(template_id)
    return variant['render'](invoice, payment, clinic, config)
