"""Prescriptions printed onto a clinic's own pre-printed stationery.

The invoice side of this lives in tests/domains/finance/test_letterhead_mode.py.
Prescriptions need their own file because they render very differently: four
variants, each a separate HTML file filled by string replacement, and each with
its own idea of the page box. Two of them reserve a bottom band on `@page` for a
fixed footer bar, so "the default margin" is not one value — it comes off the
variant registry, which is why these tests check each variant by name rather
than asserting one shared default.

Note the name collision, which is worth keeping straight: the variant *called*
`letterhead` is a styled doctor's pad that we draw ourselves. Letterhead *mode*
is the opposite — it stops us drawing anything, because the paper already
carries it. Every variant supports the mode, that one included.
"""
import re
from types import SimpleNamespace as NS

import pytest

from domains.medical.prescription_templates import PRESCRIPTION_VARIANTS
from domains.medical.services.prescription_service import PrescriptionService

VARIANTS = ['classic', 'compact', 'letterhead', 'accent', 'plain']

# `plain` draws no clinic header at all, by design, so the tests about hiding
# one do not apply to it — it has its own at the bottom of this file.
BRANDED = [v for v in VARIANTS if v != 'plain']

# Deliberately nothing the sample patient also has: the patient's own phone
# stays on the page in letterhead mode (it is content, not branding), so a
# shared number would make a leak check pass for the wrong reason.
CLINIC_PHONE = '4441112222'

ON = {'enabled': True, 'top_mm': 45, 'bottom_mm': 20, 'left_mm': 30, 'right_mm': 28}


def _clinic():
    return NS(
        id=1, name='Royal Smile Dental Care', address='12 MG Road, Pune',
        phone=CLINIC_PHONE, email='hi@royalsmile.in',
        tagline='Smile with confidence', license_number='MH-DEN-4471',
        logo_url=None, primary_color='#2a276e', doctor_name='Dr R Sharma',
        currency_symbol='₹', country='IN',
    )


def _cfg(template_id, letterhead=None, show=None):
    body = {}
    if letterhead is not None:
        body['letterhead'] = letterhead
    if show is not None:
        body['show'] = show
    return NS(primary_color='#2a276e', footer_text='Thanks for visiting',
              logo_url=None, template_id=template_id, config_json=body or None)


def _render(template_id, letterhead=None, show=None):
    from domains.infrastructure.services.preview_samples import (
        sample_patient, sample_prescription_request,
    )
    return PrescriptionService(None).render_prescription_html(
        sample_patient(), _clinic(), sample_prescription_request(),
        config_override=_cfg(template_id, letterhead, show),
    )


def _page_rule(html):
    match = re.search(r'@page\s*\{[^}]*\}', html)
    assert match, 'every prescription must declare a page box'
    return match.group(0)


def _body(html):
    """Just the document. Class names like `signature-line` appear in every
    template's stylesheet too, so asserting against the whole file would pass
    whether or not the element was actually rendered."""
    return html.split('<body', 1)[1]


def _strip_element(html, cls):
    """Remove the element carrying `cls`, and everything inside it.

    Balanced-tag scanning rather than a regex: these containers nest (classic's
    header holds two child divs), and a non-greedy `.*?</div>` stops at the
    first close tag, which leaves most of the header on the page and quietly
    turns this whole check into a pass.
    """
    pattern = re.compile(r'<(\w+)[^>]*class="[^"]*\b' + re.escape(cls) + r'\b[^"]*"[^>]*>')
    while True:
        match = pattern.search(html)
        if not match:
            return html
        tag = match.group(1)
        if match.group(0).endswith('/>'):
            html = html[:match.start()] + html[match.end():]
            continue
        depth, pos = 1, match.end()
        step = re.compile(r'</?' + tag + r'\b[^>]*>', re.I)
        while depth:
            nxt = step.search(html, pos)
            if not nxt:
                return html[:match.start()]  # unbalanced: drop the remainder
            depth += -1 if nxt.group(0).startswith('</') else 1
            pos = nxt.end()
        html = html[:match.start()] + html[pos:]


def _visible(html):
    """The document with everything letterhead mode hides taken out.

    Branding is suppressed two ways: the placeholder-driven fields go empty via
    the visibility flags, and the container that draws the header or footer bar
    is dropped by a CSS rule. Only checking the raw HTML would miss the second
    kind, so this strips the hidden elements and looks at what is actually left
    to land on the paper.
    """
    # `[^{}]` and not `[^{]`: the hide rule sits immediately after the @page
    # rule, and a class excluding only the open brace runs straight through the
    # preceding `}` and captures the page margins as part of the selector list.
    rule = re.search(r'([^{}]*)\{ display: none !important; \}', html)
    selectors = [x.strip().lstrip('.') for x in rule.group(1).split(',')] if rule else []
    body = _body(html)
    for cls in selectors:
        body = _strip_element(body, cls)
    return body


def _visible_branding_area(html):
    """`_visible`, minus the signature block.

    The clinic's name legitimately survives inside the signature — that block
    stays on purpose — so a branding check has to exclude it or it would fail on
    the one piece of the design that is meant to be there.
    """
    return _strip_element(_visible(html), 'signature-box')


# ── Off by default ──────────────────────────────────────────────────────────

@pytest.mark.parametrize('variant', VARIANTS)
def test_no_config_keeps_the_variants_own_page_box(variant):
    """The margin each template used to hardcode, re-emitted from the registry.

    This is the assertion that makes the golden files safe: the placeholder
    swap is only invisible if it reproduces the original rule exactly.
    """
    expected = PRESCRIPTION_VARIANTS[variant]['page_margin']
    assert _page_rule(_render(variant)) == f'@page {{ size: A4; margin: {expected}; }}'


@pytest.mark.parametrize('variant', VARIANTS)
def test_no_config_prints_all_the_branding(variant):
    html = _render(variant)
    assert 'Royal Smile Dental Care' in html
    assert 'display: none !important' not in html


@pytest.mark.parametrize('variant', VARIANTS)
def test_letterhead_absent_or_disabled_is_the_same_as_no_config(variant):
    baseline = _render(variant)
    assert _render(variant, {'enabled': False, 'top_mm': 45}) == baseline
    assert _render(variant, {}) == baseline


@pytest.mark.parametrize('junk', [{'enabled': 'yes please'}, {'enabled': None},
                                  'not a dict', 42, []])
def test_malformed_settings_resolve_to_off_not_to_a_guess(junk):
    """A corrupt config must give the clinic the document it has always had."""
    assert _page_rule(_render('classic', junk)) == '@page { size: A4; margin: 2mm; }'


# ── On ──────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize('variant', VARIANTS)
def test_enabled_reserves_the_four_margins(variant):
    # CSS shorthand order is top right bottom left, which is not the order the
    # editor collects them in — worth pinning, because getting it wrong swaps
    # the left and right bands and the error only shows up on paper.
    assert _page_rule(_render(variant, ON)) == \
        '@page { size: A4; margin: 45mm 28mm 20mm 30mm; }'


@pytest.mark.parametrize('variant', VARIANTS)
def test_enabled_leaves_no_branding_on_the_paper(variant):
    visible = _visible_branding_area(_render(variant, ON))
    for leak in ('Royal Smile Dental Care', '12 MG Road', CLINIC_PHONE,
                 'hi@royalsmile.in', 'Smile with confidence', 'MH-DEN-4471',
                 'Thanks for visiting'):
        assert leak not in visible, f'{variant} still prints {leak!r} over the letterhead'


@pytest.mark.parametrize('variant', VARIANTS)
def test_enabled_keeps_the_prescription_itself(variant):
    visible = _visible(_render(variant, ON))
    for kept in ('Asha Mehta', 'Amoxicillin'):
        assert kept in visible, f'{variant} lost {kept!r}'


@pytest.mark.parametrize('variant', VARIANTS)
def test_enabled_keeps_the_signature(variant):
    """A letterhead carries a clinic's identity, not a doctor's signature on
    this particular document, so the signature block has to survive."""
    assert 'signature-line' in _body(_render(variant, ON))


@pytest.mark.parametrize('variant', VARIANTS)
def test_enabled_resets_the_inner_padding(variant):
    """Otherwise the template's own padding stacks on top of the measured
    offsets and the content sits lower than the ruler said it would."""
    assert 'padding: 0;' in _render(variant, ON)


def test_offsets_are_clamped_before_they_reach_the_page():
    """A slipped keypress cannot put 9999mm on a page box."""
    assert _page_rule(_render('classic', {'enabled': True, 'top_mm': 9999})) == \
        '@page { size: A4; margin: 250mm 15mm 20mm 15mm; }'


def test_a_tall_printed_header_is_not_clipped_to_a_round_number():
    """Plenty of real stationery prints a 130mm band across the head of the
    sheet. The old 100mm per-edge cap made those clinics unable to describe
    their own paper."""
    assert _page_rule(_render('classic', {'enabled': True, 'top_mm': 130})) == \
        '@page { size: A4; margin: 130mm 15mm 20mm 15mm; }'


def test_a_pair_that_cannot_fit_is_scaled_back_in_proportion():
    """Both numbers came off the same sheet, so there is no ground for deciding
    which was the mistake. Gutting whichever happened to be larger would move
    the content somewhere nobody asked for and leave the other edge looking
    untouched and correct."""
    rule = _page_rule(_render('classic', {'enabled': True,
                                          'top_mm': 200, 'bottom_mm': 150}))
    top, _, bottom, _ = rule.split('margin: ')[1].rstrip('; }').split()
    top, bottom = int(top[:-2]), int(bottom[:-2])
    assert top + bottom == 297 - 25          # a printable strip survives
    assert top > bottom                       # and the proportion is kept
    assert 150 < top < 200


def test_sides_that_cannot_fit_are_scaled_back_too():
    rule = _page_rule(_render('classic', {'enabled': True,
                                          'left_mm': 120, 'right_mm': 120}))
    parts = rule.split('margin: ')[1].rstrip('; }').split()
    left, right = int(parts[3][:-2]), int(parts[1][:-2])
    assert left + right == 210 - 25
    assert abs(left - right) <= 1             # equal asks, equal trim


def test_letterhead_never_turns_a_hidden_field_back_on():
    """The mode may only ever suppress. A clinic that hid its signature keeps
    it hidden when it switches to headed paper."""
    assert 'signature-line' not in _body(_render('classic', ON, show={'signature': False}))


# ── The individual toggles (Phase 2) ────────────────────────────────────────

def test_doctor_name_toggle_hides_the_header_name_not_the_signature():
    shown = _render('classic', show={'doctor_name': True})
    hidden = _render('classic', show={'doctor_name': False})
    assert '<div class="doc-name">Dr R Sharma</div>' in shown
    assert '<div class="doc-name">Dr R Sharma</div>' not in hidden
    # The signature line falls back to the doctor's name as its label; hiding
    # the header name must not blank the thing people sign above.
    assert 'signature-line' in _body(hidden)


def test_logo_toggle_draws_nothing_rather_than_the_initials_box():
    """Hidden means absent. Falling through to the initials fallback would
    substitute a different mark, which is not what "hide the logo" asks for."""
    html = _render('classic', show={'logo': False})
    assert 'dashed' not in html


@pytest.mark.parametrize('variant', VARIANTS)
def test_patient_contact_toggle(variant):
    assert '9876543210' not in _render(variant, show={'patient_contact': False})


@pytest.mark.parametrize('variant', VARIANTS)
def test_patient_age_gender_toggle(variant):
    html = _render(variant, show={'patient_age_gender': False})
    assert 'Female' not in html
    # No orphaned separator. Classic and compact print "34 / Female" as one
    # phrase, so blanking the two values independently used to leave a " / "
    # floating where the age had been.
    assert ' / </p>' not in html and '<p> / ' not in html


# Compact is not in this list on purpose: it prints the age unlabelled, as a
# bare "34 / Female" line, so there is no label for it to keep.
@pytest.mark.parametrize('variant', ['classic', 'letterhead', 'accent'])
def test_patient_age_gender_toggle_keeps_the_label(variant):
    """The value goes, the labelled row stays: dropping the row would shift
    every field below it in a fixed label/value grid."""
    assert 'Age' in _body(_render(variant, show={'patient_age_gender': False}))


# ── The clinic name is a field like any other ───────────────────────────────

@pytest.mark.parametrize('variant', BRANDED)
def test_clinic_name_toggle(variant):
    """Reported by a clinic that unticked every box and still had its name on
    the document — because there was no box for the name."""
    assert 'Royal Smile Dental Care' in _render(variant)
    assert 'Royal Smile Dental Care' not in _render(variant, show={'clinic_name': False})


@pytest.mark.parametrize('variant', VARIANTS)
def test_unticking_everything_leaves_no_clinic_on_the_page(variant):
    from domains.infrastructure.services.pdf_fields import FIELD_KEYS

    html = _render(variant, show={k: False for k in FIELD_KEYS})
    for leak in ('Royal Smile Dental Care', '12 MG Road', CLINIC_PHONE,
                 'hi@royalsmile.in', 'Smile with confidence', 'MH-DEN-4471'):
        assert leak not in html, f'{variant} still prints {leak!r} with every box unticked'


# ── The plain layout ────────────────────────────────────────────────────────

def test_plain_carries_no_clinic_header_even_with_everything_on():
    """It exists for pre-printed paper, so choosing it is choosing an unbranded
    sheet. Only the signature's clinic line remains, and that has its own flag."""
    html = _body(_render('plain'))
    for leak in ('12 MG Road', CLINIC_PHONE, 'hi@royalsmile.in',
                 'Smile with confidence', 'MH-DEN-4471'):
        assert leak not in html, f'the plain layout printed {leak!r}'


def test_plain_still_carries_the_prescription():
    html = _body(_render('plain'))
    for kept in ('Asha Mehta', 'Amoxicillin', 'class="rx"'):
        assert kept in html


def test_plain_under_letterhead_prints_nothing_of_the_clinic():
    html = _body(_render('plain', ON))
    for leak in ('Royal Smile Dental Care', '12 MG Road', CLINIC_PHONE,
                 'hi@royalsmile.in', 'Smile with confidence', 'MH-DEN-4471'):
        assert leak not in html
    assert 'Asha Mehta' in html and 'Amoxicillin' in html
