"""Payment receipt template registry.

Mirrors `invoice_templates` deliberately, and keys off the *same* `template_id`
the clinic picked for its invoices. A clinic never chooses a receipt design
separately: the receipt is the invoice's counterpart, so the two documents in a
patient's hands have to look like they came from the same practice. Picking
Classic for invoices picks Classic for receipts, and the legacy aliases are
shared so old DB rows resolve identically on both sides.

To add a variant, add it to `invoice_templates` first, then add the matching
receipt module here under the same id — the fallback below means a missing
counterpart degrades to Classic rather than 500-ing.
"""
from domains.finance.invoice_templates import LEGACY_ALIASES
from domains.finance.receipt_templates import classic, modern


RECEIPT_VARIANTS = {
    'classic': {
        'id': 'classic',
        'name': 'Classic',
        'render': classic.render_receipt,
    },
    'modern': {
        'id': 'modern',
        'name': 'Modern Compact',
        'render': modern.render_receipt,
    },
}


def resolve_variant(template_id):
    """Look up a receipt variant by the clinic's invoice template id, with the
    invoice registry's legacy aliasing and the same safe fallback to classic."""
    if template_id in RECEIPT_VARIANTS:
        return RECEIPT_VARIANTS[template_id]
    aliased = LEGACY_ALIASES.get(template_id)
    if aliased and aliased in RECEIPT_VARIANTS:
        return RECEIPT_VARIANTS[aliased]
    return RECEIPT_VARIANTS['classic']
