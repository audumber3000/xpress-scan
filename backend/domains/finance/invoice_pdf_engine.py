"""Invoice PDF engine — thin dispatcher.

The actual rendering lives in `invoice_templates/<variant>.py`. This module is
the stable public entry point that production code (invoices route, preview
endpoint, golden tests) imports. It picks a variant from `config.template_id`
and falls back to `classic` for unknown / legacy / missing values.
"""
from domains.finance.invoice_templates import resolve_variant


def generate_invoice_html(invoice, clinic, config=None) -> str:
    template_id = getattr(config, 'template_id', None) if config else None
    variant = resolve_variant(template_id)
    return variant['render'](invoice, clinic, config)
