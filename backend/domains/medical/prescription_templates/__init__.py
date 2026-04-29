"""Prescription template registry.

Each variant maps a `template_id` to an HTML template *file* in
`backend/templates/`. The PrescriptionService builds a single `template_data`
dict and feeds it through the chosen template — the variant just decides which
HTML file consumes that data, not how the data is built.

To add a new variant:
1. Create a new HTML file in `backend/templates/` consuming the same
   `{{placeholder}}` set as `prescription_template.html`.
2. Register it in `PRESCRIPTION_VARIANTS` below with name + description.
3. Add a golden test in `tests/domains/medical/`.
"""

PRESCRIPTION_VARIANTS = {
    'classic': {
        'id': 'classic',
        'name': 'Classic',
        'description': 'Traditional letterhead with full-width header, Rx symbol, medications table, and signature block.',
        'thumbnail': '/static/template-thumbnails/prescription-classic.png',
        'template_file': 'prescription_template.html',
    },
    'compact': {
        'id': 'compact',
        'name': 'Compact',
        'description': 'Single-line letterhead, condensed medications table, no Rx ornament. Saves ~25% of the page.',
        'thumbnail': '/static/template-thumbnails/prescription-compact.png',
        'template_file': 'prescription_template_compact.html',
    },
}

LEGACY_ALIASES = {
    'standard': 'classic',
    'default':  'classic',
    '':         'classic',
    None:       'classic',
}


def resolve_variant(template_id):
    """Look up a variant by id, with legacy aliasing + safe fallback."""
    if template_id in PRESCRIPTION_VARIANTS:
        return PRESCRIPTION_VARIANTS[template_id]
    aliased = LEGACY_ALIASES.get(template_id)
    if aliased and aliased in PRESCRIPTION_VARIANTS:
        return PRESCRIPTION_VARIANTS[aliased]
    return PRESCRIPTION_VARIANTS['classic']


def list_variants():
    return [
        {
            'id': v['id'],
            'name': v['name'],
            'description': v['description'],
            'thumbnail': v['thumbnail'],
        }
        for v in PRESCRIPTION_VARIANTS.values()
    ]
