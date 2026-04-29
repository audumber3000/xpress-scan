"""Consent template registry — same shape as invoice_templates / prescription_templates.

The actual signed-consent PDF rendering moved here from Nexus in Phase 8.
Nexus's `process_signature` flow now POSTs to `/api/v1/internal/consent/render`
to produce the PDF; this is the canonical place to evolve consent layouts.
"""
from domains.consent.consent_templates import classic

CONSENT_VARIANTS = {
    'classic': {
        'id': 'classic',
        'name': 'Classic',
        'description': 'Standard letterhead, terms section, prominent signature block, fixed-position page footer.',
        'thumbnail': '/static/template-thumbnails/consent-classic.png',
        'render': classic.render_consent,
    },
}

LEGACY_ALIASES = {
    'standard': 'classic',
    'default':  'classic',
    '':         'classic',
    None:       'classic',
}


def resolve_variant(template_id):
    if template_id in CONSENT_VARIANTS:
        return CONSENT_VARIANTS[template_id]
    aliased = LEGACY_ALIASES.get(template_id)
    if aliased and aliased in CONSENT_VARIANTS:
        return CONSENT_VARIANTS[aliased]
    return CONSENT_VARIANTS['classic']


def list_variants():
    return [
        {
            'id': v['id'],
            'name': v['name'],
            'description': v['description'],
            'thumbnail': v['thumbnail'],
        }
        for v in CONSENT_VARIANTS.values()
    ]
