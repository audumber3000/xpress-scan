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
    # First on purpose: a clinic printing on its own headed paper is better
    # served by a layout with no clinic header than by a decorated one with the
    # header switched off. Note the name clash with the `letterhead` variant
    # below, which is the opposite thing — a printed pad we draw ourselves.
    'plain': {
        'id': 'plain',
        'name': 'Plain (for letterhead)',
        'description': 'No clinic header, logo or colour at all — just the patient, the Rx and the medicines. Built for printing onto your own pre-printed letterhead.',
        'thumbnail': '/static/template-thumbnails/prescription-plain.png',
        'template_file': 'prescription_template_plain.html',
        'page_margin': '0',
        'letterhead_hide': '',
        'letterhead_reset': '.page { padding: 0; }',
    },
    'classic': {
        'id': 'classic',
        'name': 'Classic',
        'description': 'Traditional letterhead with full-width header, Rx symbol, medications table, and signature block.',
        'thumbnail': '/static/template-thumbnails/prescription-classic.png',
        'template_file': 'prescription_template.html',
        'logo_wrapper': '<div style="margin-right:20px;flex-shrink:0;">{logo}</div>',
        'clinic_name_html': '<h1>{name}</h1>',
        'page_margin': '2mm',
        'letterhead_hide': '.header, .color-strip',
        'letterhead_reset': '.prescription-body { padding: 0; }',
    },
    'compact': {
        'id': 'compact',
        'name': 'Compact',
        'description': 'Single-line letterhead, condensed medications table, no Rx ornament. Saves ~25% of the page.',
        'thumbnail': '/static/template-thumbnails/prescription-compact.png',
        'template_file': 'prescription_template_compact.html',
        'clinic_name_html': '<div class="name">{name}</div>',
        'page_margin': '2mm',
        'letterhead_hide': '.head',
        'letterhead_reset': '.page { padding: 0; }',
    },
    'letterhead': {
        'id': 'letterhead',
        'name': 'Letterhead',
        'description': 'A printed doctor\'s pad: name set large, tinted side panels, patient details on ruled lines and a serif Rx mark.',
        'thumbnail': '/static/template-thumbnails/prescription-letterhead.png',
        'template_file': 'prescription_template_letterhead.html',
        'clinic_name_html': '<div class="clinic-line">{name}</div>',
        'page_margin': '0 0 74px 0',
        'letterhead_hide': '.head, .edge-top, .edge-bottom, .edge-bottom2, .foot',
        'letterhead_reset': '.page { padding: 0; }',
    },
    'accent': {
        'id': 'accent',
        'name': 'Accent Header',
        'description': 'A solid header band in your colour with the doctor\'s name reversed out of it, over a large watermarked Rx.',
        'thumbnail': '/static/template-thumbnails/prescription-accent.png',
        'template_file': 'prescription_template_accent.html',
        'clinic_name_html': '<div class="clinic-line">{name}</div>',
        'page_margin': '0 0 76px 0',
        'letterhead_hide': '.band, .foot',
        'letterhead_reset': '.page { padding: 0; }',
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
