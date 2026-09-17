"""Pen notes as a PDF, filed on the patient's record.

The drawing is rendered in the browser — that is where the ink geometry lives —
and arrives here as one SVG per page. This module turns those into a letterheaded
A4 document.

─── Why the SVG is rebuilt rather than rendered ─────────────────────────────

WeasyPrint fetches whatever an SVG references: `<image href="file:///etc/passwd">`
reads a file off this server into the PDF, and an `href` pointing at the cloud
metadata address reads credentials. The SVG comes from a browser, so it is
treated as hostile no matter who sent it.

So nothing from the request is passed through. The markup is parsed with
entities and network access disabled, and a NEW tree is built from an allowlist:
six element types, a fixed attribute set for each, and every value checked
against a pattern for what that attribute can legitimately hold. Anything else —
`href`, `style`, event handlers, `<image>`, `<foreignObject>`, `<use>`, CSS — is
not escaped or neutralised; it is simply never copied. On top of that the render
runs with a URL fetcher that refuses every URL, so even a mistake in the
allowlist cannot reach the network or the disk.
"""
import datetime as _dt
import html
import re
import secrets

from lxml import etree

from domains.infrastructure.services.pdf_safety import safe_text

SVG_NS = 'http://www.w3.org/2000/svg'

MAX_PAGES = 20
MAX_SVG_BYTES = 3 * 1024 * 1024
MAX_ELEMENTS = 50_000
MAX_TEXT = 40

_NUM = re.compile(r'^-?(\d+(\.\d*)?|\.\d+)([eE]-?\d+)?$')
_COLOR = re.compile(r'^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|none)$')
_PATH = re.compile(r'^[MmQqLlZzCcHhVvTtSs0-9eE.,\-\s]*$')
_VIEWBOX = re.compile(r'^\s*-?[\d.]+(\s+-?[\d.]+){3}\s*$')
_WORDS = re.compile(r'^[A-Za-z ]{1,40}$')
_FONT_FAMILY = re.compile(r'^[A-Za-z0-9 ,\-]{1,80}$')
_FONT_WEIGHT = re.compile(r'^(normal|bold|[1-9]00)$')
_ANCHOR = re.compile(r'^(start|middle|end)$')
_JOIN = re.compile(r'^(round|miter|bevel)$')
_CAP = re.compile(r'^(round|butt|square)$')

MAX_PATH_CHARS = 400_000

_NUMERIC = {'x', 'y', 'width', 'height', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2',
            'stroke-width', 'opacity', 'font-size', 'letter-spacing'}

_CHECKS = {
    **{a: _NUM for a in _NUMERIC},
    'fill': _COLOR,
    'stroke': _COLOR,
    'viewBox': _VIEWBOX,
    'preserveAspectRatio': _WORDS,
    'font-family': _FONT_FAMILY,
    'font-weight': _FONT_WEIGHT,
    'text-anchor': _ANCHOR,
    'stroke-linejoin': _JOIN,
    'stroke-linecap': _CAP,
}

# Everything that may appear, and nothing else.
ALLOWED = {
    'svg': {'viewBox', 'preserveAspectRatio'},
    'g': {'opacity'},
    'rect': {'x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'opacity'},
    'line': {'x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'opacity'},
    'path': {'d', 'fill', 'opacity', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap'},
    'text': {'x', 'y', 'text-anchor', 'font-size', 'font-weight', 'fill', 'font-family', 'letter-spacing'},
}


class SketchRejected(ValueError):
    """The request cannot be turned into a document. The message is user-safe."""


def _parser():
    return etree.XMLParser(
        resolve_entities=False, no_network=True, load_dtd=False,
        dtd_validation=False, huge_tree=False, remove_comments=True,
        remove_pis=True, recover=False,
    )


def _local(tag) -> str:
    return etree.QName(tag).localname if isinstance(tag, str) else ''


def _valid(name: str, value: str) -> bool:
    if name == 'd':
        return len(value) <= MAX_PATH_CHARS and bool(_PATH.match(value))
    check = _CHECKS.get(name)
    return bool(check and check.match(value))


def sanitize_svg(markup: str) -> str:
    """Rebuild one page's SVG from the allowlist. Raises SketchRejected."""
    if not isinstance(markup, str) or not markup.strip():
        raise SketchRejected('A page arrived empty.')
    if len(markup.encode('utf-8')) > MAX_SVG_BYTES:
        raise SketchRejected('A page is too large to export.')
    # A DTD is how entity tricks get in, and a drawing never needs one.
    if re.search(r'<!(DOCTYPE|ENTITY)', markup, re.I):
        raise SketchRejected('A page could not be read.')
    try:
        source = etree.fromstring(markup.encode('utf-8'), _parser())
    except etree.XMLSyntaxError as e:
        raise SketchRejected('A page could not be read.') from e
    if _local(source.tag) != 'svg':
        raise SketchRejected('A page could not be read.')

    count = 0

    def copy(src, parent):
        nonlocal count
        name = _local(src.tag)
        if name not in ALLOWED:
            return          # dropped with everything inside it
        count += 1
        if count > MAX_ELEMENTS:
            raise SketchRejected('A page has too much drawn on it to export.')

        attrs = {}
        for raw_name, value in src.attrib.items():
            # Namespaced attributes (xlink:href and friends) are never wanted.
            if raw_name.startswith('{'):
                continue
            if raw_name in ALLOWED[name] and _valid(raw_name, str(value).strip()):
                attrs[raw_name] = str(value).strip()

        node = (etree.Element(f'{{{SVG_NS}}}svg', nsmap={None: SVG_NS})
                if parent is None else etree.SubElement(parent, f'{{{SVG_NS}}}{name}'))
        for k, v in attrs.items():
            node.set(k, v)

        if name == 'text':
            # Text only, capped, and never child markup. lxml escapes it on the
            # way out, so a label cannot become an element.
            node.text = (''.join(src.itertext()) or '')[:MAX_TEXT]
            return node

        for child in src:
            copy(child, node)
        return node

    root = copy(source, None)
    if 'viewBox' not in root.attrib:
        raise SketchRejected('A page could not be read.')
    return etree.tostring(root, encoding='unicode')


def _refuse_urls(url, *args, **kwargs):
    """Every URL, always. Nothing in this document is fetched from anywhere."""
    raise ValueError(f'External resources are not allowed in pen notes: {url[:60]}')


def _visit_day(clinic, when) -> str:
    """The visit date as the clinic reads it."""
    from core.clinic_time import clinic_day_of
    day = clinic_day_of(clinic, when) if when else None
    return day.strftime('%d %b %Y') if day else ''


def build_html(pages, *, clinic, patient, paper, doctor_name='') -> str:
    """One A4 landscape sheet per drawn page, with a letterhead strip."""
    clinic_name = safe_text(getattr(clinic, 'name', '') or '')
    p_name = safe_text(getattr(patient, 'name', '') or '')
    p_id = safe_text(getattr(patient, 'display_id', None) or getattr(patient, 'id', '') or '')
    bits = [str(getattr(patient, 'age', '') or '').strip(),
            str(getattr(patient, 'gender', '') or '').strip().capitalize()]
    p_meta = safe_text(' / '.join(b for b in bits if b))
    visit = safe_text(_visit_day(clinic, getattr(paper, 'date', None)))
    doctor = safe_text(doctor_name or '')
    total = len(pages)

    sheets = []
    for i, svg in enumerate(pages, 1):
        sheets.append(f"""
<section class="sheet">
  <header>
    <div class="left">
      <div class="clinic">{clinic_name}</div>
      <div class="title">Pen notes{f' &middot; visit on {visit}' if visit else ''}</div>
    </div>
    <div class="right">
      <div class="patient">{p_name}</div>
      <div class="meta">{' &middot; '.join(x for x in (f'ID {p_id}' if p_id else '', p_meta) if x)}</div>
    </div>
  </header>
  <div class="page">{svg}</div>
  <footer>
    <span>{f'Drawn by {doctor}' if doctor else ''}</span>
    <span>Page {i} of {total}</span>
  </footer>
</section>""")

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Pen notes</title>
<style>
  @page {{ size: A4 landscape; margin: 10mm 12mm; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; font-family: Helvetica, Arial, sans-serif; color: #111827; }}
  .sheet {{ page-break-after: always; height: 190mm; display: block; }}
  .sheet:last-child {{ page-break-after: auto; }}
  header {{ display: flex; justify-content: space-between; align-items: flex-end;
            border-bottom: 1.5px solid #2a276e; padding-bottom: 5px; }}
  .clinic {{ font-size: 13px; font-weight: 700; color: #2a276e; }}
  .title {{ font-size: 10px; color: #6b7280; margin-top: 1px; }}
  .right {{ text-align: right; }}
  .patient {{ font-size: 12px; font-weight: 700; }}
  .meta {{ font-size: 9.5px; color: #6b7280; margin-top: 1px; }}
  /* 3:2, the shape the note was drawn in, as large as the sheet allows. */
  .page {{ width: 240mm; height: 160mm; margin: 6mm auto 0; border: 0.6px solid #e5e7eb; }}
  /* The content box, not 240mm: with a border the drawing would otherwise
     overhang it and paint over the right and bottom edges. */
  .page svg {{ width: 100%; height: 100%; display: block; }}
  footer {{ display: flex; justify-content: space-between; font-size: 9px;
            color: #9ca3af; margin-top: 4mm; }}
</style></head>
<body>{''.join(sheets)}</body></html>"""


def render_pdf(html_doc: str) -> bytes:
    """HTML to PDF bytes, with every URL refused."""
    from weasyprint import HTML
    return HTML(string=html_doc, url_fetcher=_refuse_urls).write_pdf()


def export_filename(paper) -> str:
    """Unique per export: storage keys are the filename, with nothing added."""
    day = (getattr(paper, 'date', None) or _dt.datetime.utcnow()).strftime('%Y-%m-%d')
    stamp = _dt.datetime.utcnow().strftime('%H%M%S')
    return f'pen-notes-{day}-{stamp}-{secrets.token_hex(3)}.pdf'


def display_name(clinic, paper) -> str:
    """What the Documents tab shows."""
    visit = _visit_day(clinic, getattr(paper, 'date', None))
    return f'Pen notes {visit}.pdf' if visit else 'Pen notes.pdf'


def prepare_pages(raw_pages):
    """Validate the request and return sanitised SVG strings."""
    if not isinstance(raw_pages, list) or not raw_pages:
        raise SketchRejected('There is nothing drawn to export.')
    if len(raw_pages) > MAX_PAGES:
        raise SketchRejected(f'Export up to {MAX_PAGES} pages at a time.')
    return [sanitize_svg(p) for p in raw_pages]


__all__ = [
    'SketchRejected', 'sanitize_svg', 'prepare_pages', 'build_html',
    'render_pdf', 'export_filename', 'display_name', 'html',
]
