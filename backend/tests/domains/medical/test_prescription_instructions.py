"""What a doctor writes on a medicine line, and whether it reaches the page.

Every prescription variant heads its last column "Instructions". For as long as
that column has existed the renderer put the QUANTITY in it — so "After food",
the one thing written on nearly every line, never printed, while a stray "15"
sat under a heading promising advice. Three separate places dropped the field
on the way through, which is why these tests cover the render AND the two
callers that rebuild the item shape by hand.
"""
from types import SimpleNamespace as NS

import pytest

from domains.medical.services.prescription_service import PrescriptionService

VARIANTS = ['classic', 'compact', 'letterhead', 'accent', 'plain']


def _clinic(**over):
    base = dict(
        id=1, name='Royal Smile Dental Care', address='12 MG Road, Pune',
        phone='4441112222', email='hi@royalsmile.in', tagline='Smile with confidence',
        license_number='MH-DEN-4471', logo_url=None, primary_color='#2a276e',
        doctor_name='Dr R Sharma', currency_symbol='₹', country='IN',
        document_doctors=None,
    )
    base.update(over)
    return NS(**base)


def _cfg(template_id, show=None):
    return NS(primary_color='#2a276e', footer_text='Thanks for visiting',
              logo_url=None, template_id=template_id,
              config_json={'show': show} if show else None)


def _item(**over):
    base = dict(medicine_name='Amoxicillin 500mg', dosage='1-0-1', duration='5 days',
                quantity='10', notes='', instructions='After food')
    base.update(over)
    return NS(**base)


def _render(template_id='classic', items=None, notes='', show=None, clinic=None):
    request = NS(items=items or [_item()], notes=notes)
    return PrescriptionService(None).render_prescription_html(
        NS(id=7, name='Asha Mehta', age=34, gender='female', phone='9820011111',
           display_id='PT-7'),
        clinic or _clinic(), request, config_override=_cfg(template_id, show),
    )


@pytest.mark.parametrize('variant', VARIANTS)
def test_the_instruction_is_printed(variant):
    assert 'After food' in _render(variant)


@pytest.mark.parametrize('variant', VARIANTS)
def test_the_quantity_no_longer_squats_in_the_instructions_column(variant):
    """A line WITH an instruction must not also print its quantity there.

    The check is `<td>10</td>`, not a bare "10" — the medicine is called
    "Amoxicillin 500mg" and a substring search would find the 500 too.
    """
    assert '<td>10</td>' not in _render(variant)


def test_a_line_with_no_instruction_still_shows_its_quantity():
    """The fallback the on-screen print view has always used. A blank cell
    under a heading is worse than the quantity that used to be there."""
    html = _render(items=[_item(instructions='')])
    assert '<td>10</td>' in html


def test_a_missing_attribute_does_not_break_the_render():
    """Several callers build the item shape by hand from stored JSON. One that
    predates this field must not 500 somebody's prescription."""
    bare = NS(medicine_name='Ibuprofen 400mg', dosage='0-0-1', duration='3 days',
              quantity='3', notes='')
    assert 'Ibuprofen 400mg' in _render(items=[bare])


def test_notes_still_print_beside_the_medicine_name():
    """`notes` is the composition, and it keeps its own place. The fix moved the
    instruction into the column; it did not take the brackets with it."""
    html = _render(items=[_item(notes='Amoxycillin trihydrate')])
    assert '(Amoxycillin trihydrate)' in html
    assert 'After food' in html


# ─── The advice block's own switch ───────────────────────────────────────────

# Structured the way the drawer writes it. A bare "Advice: ..." with no CC or
# Dx also falls through the renderer's other branch and prints verbatim as
# "Clinical Notes", so a test using one would be asserting against two blocks
# at once and the switch would look broken when it is not.
ADVICE_NOTES = (
    'CC: Severe pain in lower right molar.\n'
    'Dx: Pulpitis #46.\n'
    'Advice: Avoid hard foods on the right side.'
)


def test_the_advice_block_prints_by_default():
    html = _render(notes=ADVICE_NOTES)
    assert 'Instructions / Advice:' in html
    assert 'Avoid hard foods' in html


def test_the_advice_block_can_be_switched_off():
    html = _render(notes=ADVICE_NOTES, show={'instructions_section': False})
    assert 'Instructions / Advice:' not in html
    assert 'Avoid hard foods' not in html


def test_switching_the_advice_block_off_leaves_the_medicine_lines_alone():
    """Two different things are called "instructions" on this document. Hiding
    the block must not take the per-medicine column with it."""
    html = _render(notes=ADVICE_NOTES, show={'instructions_section': False})
    assert 'After food' in html
