"""Medical-form template registry — the same shape as consent_templates.

A signed medical history is a document, not a data dump, so it renders through
the same kind of registry the consent PDF uses and reads the same branding. A
clinic sets its letterhead once and both papers match; that is the whole reason
this sits beside consent_templates rather than growing its own scheme.
"""
from domains.forms.form_templates import classic

FORM_VARIANTS = {
    'classic': {
        'id': 'classic',
        'name': 'Classic',
        'description': 'Letterhead, sectioned answers, full condition grid, '
                       'declaration and signature block with an audit footer.',
        'thumbnail': '/static/template-thumbnails/consent-classic.png',
        'render': classic.render_medical_form,
    },
}

LEGACY_ALIASES = {'standard': 'classic', 'default': 'classic', '': 'classic', None: 'classic'}


def resolve_variant(template_id):
    if template_id in FORM_VARIANTS:
        return FORM_VARIANTS[template_id]
    aliased = LEGACY_ALIASES.get(template_id)
    if aliased and aliased in FORM_VARIANTS:
        return FORM_VARIANTS[aliased]
    return FORM_VARIANTS['classic']


def list_variants():
    return [
        {'id': v['id'], 'name': v['name'], 'description': v['description'],
         'thumbnail': v['thumbnail']}
        for v in FORM_VARIANTS.values()
    ]
