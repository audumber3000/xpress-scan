"""Printing onto a clinic's own pre-printed stationery.

Plenty of clinics already own headed paper. The sheet that prompted this has a
services list printed down the LEFT margin and a vitals box down the RIGHT, as
well as the usual band across the top — so a document that uses the full page
lands on top of all three, which is exactly what a dentist photographed and sent
in.

Two invariants matter more than the feature itself:

  * a clinic that has never opened the editor renders byte-for-byte as before
    (the golden tests assert that; these assert the flag defaults that make it
    true), and
  * malformed settings resolve to OFF, never to a guess. A clinic whose config
    is corrupt should get the document it has always got, not a page with its
    content shifted somewhere unexpected.
"""
import re
from types import SimpleNamespace as NS

import pytest

from domains.infrastructure.services.pdf_fields import (
    ALL_VISIBLE, FIELD_KEYS, LETTERHEAD_OFF, MAX_OFFSET_MM, Letterhead,
    apply_letterhead, page_css, resolve_field_visibility, resolve_letterhead,
    sanitize_letterhead,
)


def cfg(letterhead=None, show=None):
    body = {}
    if letterhead is not None:
        body['letterhead'] = letterhead
    if show is not None:
        body['show'] = show
    return NS(config_json=body or None, logo_url=None, footer_text='',
              primary_color=None, secondary_color=None)


ON = {'enabled': True, 'top_mm': 45, 'bottom_mm': 25, 'left_mm': 30, 'right_mm': 28}


# ── off unless asked for ────────────────────────────────────────────────────

@pytest.mark.parametrize("config", [
    None,
    NS(config_json=None),
    NS(config_json='not a dict'),
    NS(config_json={}),
    NS(config_json={'letterhead': 'nonsense'}),
    NS(config_json={'letterhead': {}}),
    NS(config_json={'letterhead': {'enabled': False, 'top_mm': 45}}),
])
def test_anything_short_of_an_explicit_yes_is_off(config):
    assert resolve_letterhead(config).enabled is False


def test_off_means_the_templates_own_page_box():
    assert page_css(LETTERHEAD_OFF) == "@page { size: A4; margin: 2mm; }"


def test_off_changes_no_visibility_flag():
    """The guarantee behind the golden tests."""
    assert apply_letterhead(ALL_VISIBLE, LETTERHEAD_OFF) == ALL_VISIBLE


# ── the four offsets ────────────────────────────────────────────────────────

def test_all_four_edges_are_independent():
    """Not just a top margin: the stationery prints down the sides too."""
    lh = resolve_letterhead(cfg(ON))
    assert (lh.top_mm, lh.right_mm, lh.bottom_mm, lh.left_mm) == (45, 28, 25, 30)


def test_the_css_is_top_right_bottom_left():
    """CSS shorthand order. Getting this wrong swaps left and right, which on a
    sheet with a services column down one side is the whole bug again."""
    assert page_css(resolve_letterhead(cfg(ON))) == \
        "@page { size: A4; margin: 45mm 28mm 25mm 30mm; }"


@pytest.mark.parametrize("given,expected", [
    (450, MAX_OFFSET_MM),   # a typo that would leave no printable area
    (-10, 0),
    ('45.4', 45),           # typed off a ruler
    ('nonsense', 45),       # falls back to the default for that edge
])
def test_offsets_are_clamped_not_trusted(given, expected):
    lh = resolve_letterhead(cfg({'enabled': True, 'top_mm': given}))
    assert lh.top_mm == expected


def test_a_missing_edge_takes_its_default():
    lh = resolve_letterhead(cfg({'enabled': True, 'top_mm': 60}))
    assert lh.top_mm == 60
    assert lh.bottom_mm == Letterhead().bottom_mm


# ── what it suppresses ──────────────────────────────────────────────────────

def test_our_branding_comes_off_because_the_paper_carries_it():
    vis = apply_letterhead(ALL_VISIBLE, resolve_letterhead(cfg(ON)))
    for field in ('logo', 'contact', 'address', 'tagline', 'license_number', 'footer'):
        assert getattr(vis, field) is False, field


def test_the_signature_block_survives():
    """A letterhead carries a clinic's identity, not a doctor's signature on
    this particular document."""
    vis = apply_letterhead(ALL_VISIBLE, resolve_letterhead(cfg(ON)))
    assert vis.signature is True


def test_it_never_turns_anything_back_on():
    """The house rule for this whole module: a flag may only ever hide."""
    hidden = resolve_field_visibility(cfg(ON, show={'signature': False, 'discount': False}))
    vis = apply_letterhead(hidden, resolve_letterhead(cfg(ON)))
    assert vis.signature is False
    assert vis.discount is False


# ── sanitising what the client sends ────────────────────────────────────────

def test_unknown_keys_are_dropped():
    out = sanitize_letterhead({'enabled': True, 'top_mm': 40, 'evil': 'x' * 5000})
    assert set(out) <= {'enabled', 'top_mm', 'bottom_mm', 'left_mm', 'right_mm'}


def test_sanitize_refuses_non_dicts():
    assert sanitize_letterhead('nope') is None
    assert sanitize_letterhead(None) is None


# ── end to end through the real renderers ───────────────────────────────────

def _invoice():
    item = NS(tooth_number='16', description='RCT', service_name='RCT', quantity=1,
              unit_price=4000, amount=4000, total=4000, discount=0, rate=4000)
    return NS(invoice_number='INV-1', line_items=[item], subtotal=4000, total=4000,
              tax=0, discount_amount=0, notes='', status='finalized', created_at=None,
              payment_mode='Cash', appointment=None,
              patient=NS(id=1, name='Deepa Sonbarsa', phone='9826196645', age=56,
                         gender='female', uhid='100010', village='Raipur'))


def _clinic():
    return NS(name='Royal Smile Dental Care', phone='9977712441', email='rs@x.com',
              address='Main Road Sanjay Nagar, Raipur', logo_url=None,
              currency_symbol='₹', country='IN', tagline='Multispeciality',
              license_number='CGDC/13/G/1463', gst_number='22AAAAA0000A1Z5',
              doctor_name='Dr. Rakesh Singh Gaikwad', primary_color='#FF9800')


@pytest.mark.parametrize("variant", ["classic", "modern"])
def test_the_rendered_document_carries_no_branding_of_ours(variant):
    mod = __import__(f'domains.finance.invoice_templates.{variant}',
                     fromlist=['render_invoice'])
    html = mod.render_invoice(_invoice(), _clinic(), cfg(ON))

    assert "@page { size: A4; margin: 45mm 28mm 25mm 30mm; }" in html
    for leak in ('Main Road Sanjay Nagar', '9977712441', 'Multispeciality', 'CGDC/13'):
        assert leak not in html, f"{variant} still prints {leak!r} over the letterhead"
    # ...and the document itself is all still there.
    for kept in ('Deepa Sonbarsa', 'INV-1', '4,000'):
        assert kept in html, f"{variant} lost {kept!r}"


@pytest.mark.parametrize("variant", ["classic", "modern"])
def test_with_no_config_the_branding_is_all_present(variant):
    mod = __import__(f'domains.finance.invoice_templates.{variant}',
                     fromlist=['render_invoice'])
    html = mod.render_invoice(_invoice(), _clinic(), None)
    assert "margin: 2mm" in html
    assert 'Royal Smile Dental Care' in html
    assert 'Main Road Sanjay Nagar' in html


# ── The whole-blob sanitizer ────────────────────────────────────────────────
#
# The two halves of config_json had a sanitizer each and no shared entry point,
# so the save path and the preview path each picked their own subset — and they
# disagreed. The preview ran sanitize_visibility, which keeps only `show`, so a
# clinic could tick "pre-printed letterhead", watch the preview not move, and
# reasonably conclude the setting had not taken.

def test_sanitize_config_json_keeps_both_halves():
    from domains.infrastructure.services.pdf_fields import sanitize_config_json

    out = sanitize_config_json({'show': {'address': False}, 'letterhead': ON})
    assert out['show'] == {'address': False}
    assert out['letterhead']['enabled'] is True
    assert out['letterhead']['top_mm'] == 45


def test_sanitize_config_json_survives_each_half_alone():
    from domains.infrastructure.services.pdf_fields import sanitize_config_json

    assert sanitize_config_json({'letterhead': ON})['letterhead']['enabled'] is True
    assert 'letterhead' not in sanitize_config_json({'show': {'address': False}})


def test_sanitize_config_json_drops_junk_and_clamps():
    from domains.infrastructure.services.pdf_fields import sanitize_config_json

    out = sanitize_config_json({
        'show': {'address': False, 'evil': 'x' * 5000},
        'letterhead': {'enabled': True, 'top_mm': 9999, 'evil': 'y' * 5000},
        'unknown_key': {'anything': True},
    })
    assert out['show'] == {'address': False}
    assert out['letterhead'] == {'enabled': True, 'top_mm': MAX_OFFSET_MM}
    assert 'unknown_key' not in out


def test_sanitize_config_json_returns_none_for_nothing():
    from domains.infrastructure.services.pdf_fields import sanitize_config_json

    assert sanitize_config_json(None) is None
    assert sanitize_config_json('nope') is None
    assert sanitize_config_json({}) is None


def test_the_preview_payload_carries_the_letterhead_through():
    """The editor's live preview is the only place a clinic can check the band
    before committing a sheet of headed paper to the printer."""
    from domains.infrastructure.services.preview_samples import config_from_payload

    built = config_from_payload({'config_json': {'show': {}, 'letterhead': ON}})
    assert resolve_letterhead(built).enabled is True
    assert resolve_letterhead(built).top_mm == 45


# ── Every variant, not just the two with goldens ────────────────────────────
#
# The first pass of this feature was written against `classic` and `modern`,
# because those are the two pinned by golden tests and so the two most obviously
# at risk. That was the wrong reading of risk: the other four share `prepare()`,
# which made them look covered, and they were not. They hardcoded
# `@page { margin: 0 }` and so ignored letterhead mode completely, printing the
# document straight over the clinic's stationery — the exact defect the feature
# exists to fix. These run over the registry so a new variant cannot repeat it.

from domains.finance.invoice_templates import INVOICE_VARIANTS

ALL_INVOICE_VARIANTS = sorted(INVOICE_VARIANTS)

# `plain` draws no clinic header at all, by design, so the tests about hiding
# one do not apply to it — it has its own further down. Keeping it out by name
# here beats an `or variant == 'plain'` escape hatch inside the assertions,
# which would quietly excuse a real failure on any other variant too.
BRANDED_VARIANTS = [v for v in ALL_INVOICE_VARIANTS if v != 'plain']

CLINIC_BRANDING = {
    'clinic name': 'Royal Smile Dental Care',
    'address': 'Main Road Sanjay Nagar',
    'phone': '9977712441',
    'tagline': 'Multispeciality',
    'licence': 'CGDC/13',
}


def _render(variant, show=None, letterhead=None):
    return INVOICE_VARIANTS[variant]['render'](_invoice(), _clinic(), cfg(letterhead, show))


@pytest.mark.parametrize("variant", ALL_INVOICE_VARIANTS)
def test_every_variant_reserves_the_margins(variant):
    html = _render(variant, letterhead=ON)
    assert "@page { size: A4; margin: 45mm 28mm 25mm 30mm; }" in html, (
        f"{variant} ignores letterhead mode and prints over the clinic's paper")


@pytest.mark.parametrize("variant", ALL_INVOICE_VARIANTS)
def test_every_variant_drops_branding_under_letterhead(variant):
    html = _render(variant, letterhead=ON)
    for label, value in CLINIC_BRANDING.items():
        assert value not in html, f'{variant} still prints the {label}'


@pytest.mark.parametrize("variant", ALL_INVOICE_VARIANTS)
def test_every_variant_keeps_the_document_under_letterhead(variant):
    html = _render(variant, letterhead=ON)
    for kept in ('Deepa Sonbarsa', 'INV-1', '4,000'):
        assert kept in html, f'{variant} lost {kept!r}'


# ── The clinic name is a field like any other ───────────────────────────────

@pytest.mark.parametrize("variant", BRANDED_VARIANTS)
def test_clinic_name_toggle(variant):
    """Reported by a clinic that unticked every box and still had its name on
    the bill — because there was no box for the name."""
    assert 'Royal Smile Dental Care' in _render(variant)
    assert 'Royal Smile Dental Care' not in _render(variant, show={'clinic_name': False})


@pytest.mark.parametrize("variant", ALL_INVOICE_VARIANTS)
def test_unticking_everything_leaves_no_clinic_on_the_page(variant):
    """The whole-panel version of the complaint: all boxes off means all off."""
    html = _render(variant, show={k: False for k in FIELD_KEYS})
    for label, value in CLINIC_BRANDING.items():
        assert value not in html, f'{variant} still prints the {label} with every box unticked'


# ── Hiding the logo must not substitute a monogram ─────────────────────────

@pytest.mark.parametrize("variant", BRANDED_VARIANTS)
def test_hidden_logo_draws_nothing_not_initials(variant):
    """`logo_block` fell through to the initials box when the flag was off,
    which is how a clinic that hid its logo still saw a mark on the page — and
    on letterhead, a second monogram beside the printed one."""
    html = _render(variant, show={'logo': False})
    assert not re.search(r'>\s*RO\s*<', html), f'{variant} drew an initials monogram'


@pytest.mark.parametrize("variant", BRANDED_VARIANTS)
def test_a_clinic_with_no_logo_still_gets_its_monogram(variant):
    """The fallback is still right when nothing was hidden: the flag defaults to
    shown, and a clinic without a logo gets its initials rather than a gap."""
    assert re.search(r'>\s*RO\s*<', _render(variant))


# ── The plain layout ────────────────────────────────────────────────────────

def test_plain_carries_no_clinic_branding_even_with_everything_on():
    """It exists for pre-printed paper, so choosing it is choosing an unbranded
    sheet — the branding must not come back just because letterhead mode is off."""
    html = _render('plain')
    for label, value in CLINIC_BRANDING.items():
        assert value not in html, f'the plain layout printed the {label}'


def test_plain_still_carries_the_document():
    html = _render('plain')
    for kept in ('Deepa Sonbarsa', 'INV-1', '4,000', 'Invoice'):
        assert kept in html


def test_plain_defaults_to_a_printable_margin_not_a_bleed():
    """The decorated layouts bleed to the edge and inset with padding. This one
    is meant to land inside a letterhead, so its own default is a real margin."""
    assert '@page { size: A4; margin: 15mm; }' in _render('plain')


def test_plain_has_a_receipt_counterpart_that_is_also_plain():
    from domains.finance.receipt_templates import RECEIPT_VARIANTS

    assert 'plain' in RECEIPT_VARIANTS


# ── Hiding a field must remove its container, not just its words ────────────
#
# Reported as "the toggle doesn't work" on Classic. The flag *was* applying —
# `<h1></h1>` rendered empty — but an empty <h1> still reserves its line height
# and an empty logo cell still pushes the text across by its 20px margin, so
# turning off the name and the logo left a blank band where the header was
# rather than a header that had gone. From the page it is indistinguishable
# from the setting being ignored.

def test_hiding_a_field_leaves_no_empty_element_behind():
    html = _render('classic', show={'clinic_name': False, 'logo': False})
    assert '<h1></h1>' not in html
    assert 'margin-right:20px;flex-shrink:0;"></div>' not in html


def test_hiding_everything_removes_the_header_block_entirely():
    """Not merely an empty one: `.header` carries its own spacing, so an empty
    one is a gap at the top of every page."""
    html = _render('classic', show={k: False for k in FIELD_KEYS})
    assert 'class="header"' not in html
    assert 'class="header-left"' not in html
    assert 'class="clinic-info-right"' not in html
    # The invoice itself is untouched.
    assert 'INVOICE' in html and 'Deepa Sonbarsa' in html


def test_a_partly_hidden_header_keeps_the_parts_that_remain():
    """The container collapses only when it is genuinely empty."""
    html = _render('classic', show={'clinic_name': False, 'logo': False,
                                    'doctor_name': False, 'tagline': False})
    assert 'class="header"' in html          # address and contact still there
    assert 'class="header-left"' not in html  # but its whole left side has gone
    assert 'Main Road Sanjay Nagar' in html


# ── Showing the band on screen ──────────────────────────────────────────────
#
# `@page` margins are the only thing the PDF needs and they are completely inert
# in a browser — applied when paginating for print and at no other time. So a
# clinic could type 100mm into the top offset and watch the preview not move a
# pixel, which reads as the setting being ignored.

def test_the_preview_re_expresses_the_margins_as_something_a_browser_shows():
    from domains.infrastructure.routes.template_configs import _with_screen_page_box

    html = _with_screen_page_box(
        '<html><head></head><body><p>Invoice</p></body></html>',
        resolve_letterhead(cfg(ON)),
    )
    assert 'padding: 45mm 28mm 25mm 30mm !important' in html
    assert '@media screen' in html
    # A band per edge, labelled with the measurement it represents.
    for cls in ('mp-lh-top', 'mp-lh-bottom', 'mp-lh-left', 'mp-lh-right'):
        assert cls in html
    assert 'Your letterhead prints here' in html


def test_the_guide_is_screen_only_and_never_reaches_a_pdf():
    """WeasyPrint renders in print media. If any of this leaked into the print
    stylesheet it would draw hatched boxes onto a real patient's invoice."""
    from domains.infrastructure.routes.template_configs import _with_screen_page_box

    html = _with_screen_page_box('<html><head></head><body></body></html>',
                                 resolve_letterhead(cfg(ON)))
    guide = html[html.index('<style id="mp-letterhead-guide">'):html.index('</style>')]
    # Everything that paints is inside the screen block...
    screen = guide[guide.index('@media screen'):]
    assert 'padding:' in screen
    # ...and print media explicitly hides the bands.
    assert '@media print' in html
    assert 'display: none !important' in html.split('@media print')[1][:120]


def test_nothing_is_injected_when_letterhead_is_off():
    """A clinic that has never touched the setting must get the preview it has
    always had, byte for byte."""
    from domains.infrastructure.routes.template_configs import _with_screen_page_box

    source = '<html><head></head><body><p>Invoice</p></body></html>'
    assert _with_screen_page_box(source, resolve_letterhead(cfg())) == source


def test_the_bands_are_added_at_the_end_of_the_body():
    """Injected after the opening tag they landed between a table and its rows,
    which reflowed the document the guide was supposed to describe."""
    from domains.infrastructure.routes.template_configs import _with_screen_page_box

    html = _with_screen_page_box(
        '<html><head></head><body><table><tr><td>x</td></tr></table></body></html>',
        resolve_letterhead(cfg(ON)),
    )
    # The class name also appears in the stylesheet, so match the element.
    assert html.index('</table>') < html.index('<div class="mp-lh-band mp-lh-top">')
