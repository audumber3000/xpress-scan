"""Which optional fields a clinic wants printed on its documents.

Clinics differ on what belongs on a bill. Some want their licence number on
every page; some consider their GSTIN nobody's business on a prescription; a
clinic that quietly discounts for a regular does not want the concession
itemised on the paper the patient carries home. This module carries those
choices from `TemplateConfiguration.config_json` into the renderers.

Two rules keep this from silently rewriting documents that already exist:

1. **Everything defaults to shown.** A clinic that has never opened the editor
   has `config_json = None`, and must render byte-for-byte as it did before this
   existed. That is asserted by the golden tests.
2. **A flag can only ever hide.** Every use is `visible.x and <the value>`,
   never `or`. Each of these fields already printed only when its value was
   non-empty, so ANDing a default-True flag changes nothing. A flag must never
   be the reason a field *appears* — otherwise turning a toggle on would add a
   blank "Reg No:" line to every document.

Stored shape, namespaced so config_json stays free for future settings:

    {"show": {"tax_number": true, "contact": true, ...},
     "letterhead": {"enabled": true, "top_mm": 45, ...}}
"""
from dataclasses import dataclass, replace

# The switchable fields. Keep in step with the checkboxes in TemplatesEditor.jsx.
FIELD_KEYS = (
    'tax_number',      # GSTIN / VAT number (invoice + receipt only)
    'contact',         # clinic phone and email
    'license_number',  # clinic registration / licence number
    'address',         # clinic address
    'tagline',         # clinic tagline
    'footer',          # footer / disclaimer text
    'signature',       # the clinic's authorised-signatory block
    'discount',        # invoice + receipt only: the discount lines
    # Added alongside letterhead mode. Every one of these is a value the
    # templates already prepare, so each is a single `and` at the point of use.
    'logo',            # the clinic logo image
    'doctor_name',     # the treating doctor's name
    'patient_contact', # patient phone and address
    'patient_age_gender',  # the age / sex line
    'amount_in_words',     # invoice only: "Rupees four thousand only"
    'computer_generated_note',  # the "this is a computer generated..." line
    'clinic_name',     # the clinic's own name in the document header
    'doctor_qualifications',  # the letters under the doctor's name (BDS, MDS)
)


@dataclass(frozen=True)
class FieldVisibility:
    """Resolved show/hide answers, all defaulting to shown."""
    tax_number: bool = True
    contact: bool = True
    license_number: bool = True
    address: bool = True
    tagline: bool = True
    footer: bool = True
    signature: bool = True
    discount: bool = True
    logo: bool = True
    doctor_name: bool = True
    patient_contact: bool = True
    patient_age_gender: bool = True
    amount_in_words: bool = True
    computer_generated_note: bool = True
    clinic_name: bool = True
    doctor_qualifications: bool = True


ALL_VISIBLE = FieldVisibility()


def _as_bool(value, default=True):
    """Only an explicit falsey answer hides a field.

    config_json is clinic-writable JSON, so it can hold anything. Unknown or
    malformed values fall back to showing the field: a document missing its
    clinic address because of a bad cast is worse than one showing it.
    """
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() not in ('false', '0', 'no', 'off', '')
    return default


def _as_enabled(value) -> bool:
    """Strictly opt-in, which is the opposite of how the `show` flags read.

    `_as_bool` treats any string it does not recognise as true, because for a
    visibility flag the safe failure is to print the field anyway. Letterhead
    mode fails the other way: switching it on by accident strips the clinic's
    branding and shifts every document inward, so only an explicit yes counts
    and anything unrecognised leaves it off.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in ('true', '1', 'yes', 'on')
    return False


def sanitize_visibility(raw) -> dict:
    """Normalise whatever arrived from the client into the stored shape.

    Whitelists the known keys so config_json cannot grow into an unbounded blob
    of client-supplied JSON. Returns None when there is nothing to store, so an
    absent value stays absent rather than being written as an empty object.
    """
    if not isinstance(raw, dict):
        return None
    show = raw.get('show', raw)  # tolerate a bare flag map
    if not isinstance(show, dict):
        return None
    cleaned = {k: _as_bool(show.get(k)) for k in FIELD_KEYS if k in show}
    return {'show': cleaned} if cleaned else None


def resolve_field_visibility(config) -> FieldVisibility:
    """Read the flags off a template config object.

    `config` is whatever the renderers already receive: a TemplateConfiguration
    row, the SimpleNamespace the preview builds, or None. Uses getattr rather
    than attribute access on purpose — the golden-test fixtures pass a
    SimpleNamespace carrying only the four styling keys, and a direct
    `config.config_json` would raise there.
    """
    if config is None:
        return ALL_VISIBLE
    raw = getattr(config, 'config_json', None)
    if not isinstance(raw, dict):
        return ALL_VISIBLE
    show = raw.get('show')
    if not isinstance(show, dict):
        return ALL_VISIBLE
    return FieldVisibility(**{k: _as_bool(show.get(k)) for k in FIELD_KEYS})


# ─── Pre-printed letterhead ──────────────────────────────────────────────────
#
# Plenty of clinics already own headed paper and want our documents printed onto
# it. Their stationery is not merely a band across the top: the sheet that
# prompted this has a services list printed down the LEFT margin and a vitals box
# down the RIGHT, so a document that uses the full width lands on top of both.
#
# So the setting is four independent offsets, and the renderer turns them into
# `@page` margins. Everything already goes through WeasyPrint, which honours
# them, so this is a page-box change rather than a layout rewrite.
#
# Same two rules as the visibility flags above: **off unless asked for**, so a
# clinic that has never opened the editor is untouched, and it can only ever
# suppress our own branding, never add anything.

LETTERHEAD_KEYS = ('top_mm', 'bottom_mm', 'left_mm', 'right_mm')

# A4, and the smallest band of page worth printing on.
PAGE_W_MM, PAGE_H_MM = 210, 297
MIN_CONTENT_MM = 25

# The per-edge ceiling is the page itself. It used to be 100mm, chosen so that
# all four at maximum still left something printable — but that is the wrong
# constraint on the wrong axis. Plenty of real stationery prints a 130mm band
# across the head of the sheet, and capping a single edge at 100 made those
# clinics unable to describe their own paper.
#
# What actually has to hold is the PAIR: top plus bottom, and left plus right,
# must leave a strip worth printing on. That is enforced in `resolve_letterhead`
# where both halves are known, so one deliberate 130mm offset is fine and only
# a genuinely impossible pair gets trimmed.
MAX_OFFSET_MM = 250

# What a typical Indian clinic letterhead needs, used when the clinic switches
# letterhead on before measuring anything. Deliberately generous at the top.
DEFAULT_OFFSETS = {'top_mm': 45, 'bottom_mm': 20, 'left_mm': 15, 'right_mm': 15}


@dataclass(frozen=True)
class Letterhead:
    """Resolved letterhead settings. Disabled unless the clinic says otherwise."""
    enabled: bool = False
    top_mm: int = DEFAULT_OFFSETS['top_mm']
    bottom_mm: int = DEFAULT_OFFSETS['bottom_mm']
    left_mm: int = DEFAULT_OFFSETS['left_mm']
    right_mm: int = DEFAULT_OFFSETS['right_mm']

    @property
    def page_margin_css(self) -> str:
        """The four values as a CSS `margin` shorthand, top right bottom left."""
        return (f"{self.top_mm}mm {self.right_mm}mm "
                f"{self.bottom_mm}mm {self.left_mm}mm")


LETTERHEAD_OFF = Letterhead()


def _as_offset(value, default):
    """A measurement off a ruler, clamped into something printable."""
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(0, min(n, MAX_OFFSET_MM))


def _fit_pair(near: int, far: int, extent: int) -> tuple:
    """Trim two opposing offsets until a printable strip survives between them.

    Scaled down in proportion rather than taking the whole excess off one side.
    Both numbers were measured off the same sheet, so there is no ground for
    deciding that one of them was the mistake — and a rule that quietly gutted
    whichever happened to be larger would move the content somewhere the clinic
    never asked for while leaving the other edge looking untouched and correct.

    Only reached by a pair that cannot fit at all. Anything that leaves 25mm to
    print on is passed through exactly as typed.
    """
    room = extent - MIN_CONTENT_MM
    total = near + far
    if total <= room:
        return near, far
    if total <= 0:
        return 0, 0
    scaled = round(near * room / total)
    return max(0, scaled), max(0, room - scaled)


def sanitize_letterhead(raw) -> dict:
    """Normalise what arrived from the client into the stored shape.

    Whitelisted like sanitize_visibility, so config_json cannot grow into an
    unbounded blob. Returns None when there is nothing to store.
    """
    if not isinstance(raw, dict):
        return None
    enabled = _as_enabled(raw.get('enabled'))
    cleaned = {'enabled': enabled}
    for k in LETTERHEAD_KEYS:
        if k in raw:
            cleaned[k] = _as_offset(raw.get(k), DEFAULT_OFFSETS[k])
    return cleaned


def sanitize_config_json(raw) -> dict:
    """Whitelist a whole `config_json` blob before it is stored or previewed.

    The two halves already have their own sanitizers; what was missing was a
    single entry point that runs both. Without one the save path and the preview
    path each picked their own subset, and they disagreed: the preview ran
    `sanitize_visibility`, which keeps only `show`, so a clinic could tick
    "pre-printed letterhead", watch the preview not move, and reasonably
    conclude the setting had not taken.

    Returns None when there is nothing worth storing, so an absent value stays
    absent rather than being written as an empty object.
    """
    if not isinstance(raw, dict):
        return None
    cleaned = {}
    show = sanitize_visibility(raw)
    if show:
        cleaned.update(show)
    letterhead = sanitize_letterhead(raw.get('letterhead'))
    if letterhead:
        cleaned['letterhead'] = letterhead
    return cleaned or None


def resolve_letterhead(config) -> Letterhead:
    """Read the letterhead settings off a template config object.

    Anything malformed resolves to OFF rather than to a guess. A clinic whose
    config is corrupt should get the document it has always got, not a page with
    its content pushed somewhere unexpected.
    """
    if config is None:
        return LETTERHEAD_OFF
    raw = getattr(config, 'config_json', None)
    if not isinstance(raw, dict):
        return LETTERHEAD_OFF
    lh = raw.get('letterhead')
    if not isinstance(lh, dict):
        return LETTERHEAD_OFF
    if not _as_enabled(lh.get('enabled')):
        return LETTERHEAD_OFF
    offsets = {k: _as_offset(lh.get(k), DEFAULT_OFFSETS[k]) for k in LETTERHEAD_KEYS}
    # Both halves are known here, which is the only place the pair rule can be
    # applied. A page with no printable area is not a setting anyone meant.
    offsets['top_mm'], offsets['bottom_mm'] = _fit_pair(
        offsets['top_mm'], offsets['bottom_mm'], PAGE_H_MM)
    offsets['left_mm'], offsets['right_mm'] = _fit_pair(
        offsets['left_mm'], offsets['right_mm'], PAGE_W_MM)
    return Letterhead(enabled=True, **offsets)


def apply_letterhead(vis: FieldVisibility, letterhead: Letterhead) -> FieldVisibility:
    """Drop our own branding when the paper already carries it.

    Reuses the existing flags rather than adding a parallel set of conditionals
    to every renderer: if the clinic's name, address, phone and logo are printed
    on the sheet, the same fields our templates would draw are exactly the ones
    to switch off.

    The signature block deliberately stays: a letterhead carries a clinic's
    identity, not a doctor's signature on this particular document.
    """
    if not letterhead.enabled:
        return vis
    return replace(
        vis,
        logo=False, contact=False, address=False, clinic_name=False,
        tagline=False, license_number=False, footer=False,
    )


def page_css(letterhead: Letterhead, default_margin: str = '2mm',
             size: str = 'A4') -> str:
    """The `@page` rule a renderer should emit.

    One helper so every template expresses the page box the same way, and so a
    renderer never has to know what the offsets mean. Returns the template's own
    default when letterhead mode is off, which is what keeps existing documents
    byte-for-byte identical.
    """
    margin = letterhead.page_margin_css if letterhead.enabled else default_margin
    return f"@page {{ size: {size}; margin: {margin}; }}"
