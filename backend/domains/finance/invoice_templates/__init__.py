"""Invoice template registry.

Each variant is a self-contained module with a `render_invoice(invoice, clinic, config)`
function returning an HTML string. The registry maps a `template_id` to its
metadata + render function. The public dispatcher `resolve_variant` falls back
to `classic` for unknown ids — that's how legacy DB rows (`modern_orange`,
`standard`, `default`, etc.) keep rendering instead of 500-ing.

To add a new variant:
1. Create `<id>.py` next to `classic.py` exposing `render_invoice(invoice, clinic, config)`.
2. Register it in `INVOICE_VARIANTS` below with name, description, and thumbnail path.
3. Add a golden test in `tests/domains/finance/`.
"""
from domains.finance.invoice_templates import classic, modern


INVOICE_VARIANTS = {
    'classic': {
        'id': 'classic',
        'name': 'Classic',
        'description': 'Two-column letterhead with accent stripe and full Indian tax breakdown. Closest to a traditional invoice.',
        'thumbnail': '/static/template-thumbnails/invoice-classic.png',
        'render': classic.render_invoice,
    },
    'modern': {
        'id': 'modern',
        'name': 'Modern Compact',
        'description': 'Minimal letterhead, prominent invoice number and total, single-line item rows. Saves a third of the vertical space.',
        'thumbnail': '/static/template-thumbnails/invoice-modern.png',
        'render': modern.render_invoice,
    },
}

# Old `template_id` values that pre-date the registry. They all map to classic
# so existing DB rows render byte-identical to the pre-Phase-3 behaviour.
LEGACY_ALIASES = {
    'modern_orange':   'classic',
    'classic_blue':    'classic',
    'minimalist_mono': 'classic',
    'elegant_green':   'classic',
    'standard':        'classic',
    'default':         'classic',
    '':                'classic',
    None:              'classic',
}


def resolve_variant(template_id):
    """Look up a variant by id, with legacy aliasing + safe fallback."""
    if template_id in INVOICE_VARIANTS:
        return INVOICE_VARIANTS[template_id]
    aliased = LEGACY_ALIASES.get(template_id)
    if aliased and aliased in INVOICE_VARIANTS:
        return INVOICE_VARIANTS[aliased]
    return INVOICE_VARIANTS['classic']


def list_variants():
    """Public-facing variant catalog used by the templates picker UI."""
    return [
        {
            'id': v['id'],
            'name': v['name'],
            'description': v['description'],
            'thumbnail': v['thumbnail'],
        }
        for v in INVOICE_VARIANTS.values()
    ]
