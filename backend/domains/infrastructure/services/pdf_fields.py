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

    {"show": {"tax_number": true, "contact": true, ...}}
"""
from dataclasses import dataclass

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
