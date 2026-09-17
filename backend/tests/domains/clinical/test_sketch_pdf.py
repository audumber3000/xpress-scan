"""Pen notes → PDF, and why the SVG is never trusted.

The pages arrive from a browser as SVG, and WeasyPrint fetches whatever an SVG
references — a local file, or the cloud metadata address. These tests pin the
two layers that stop that: the allowlist rebuild, and a URL fetcher that
refuses everything.
"""
import datetime
from types import SimpleNamespace as NS

import pytest

from domains.clinical import sketch_pdf
from domains.clinical.sketch_pdf import (
    MAX_PAGES, SketchRejected, build_html, export_filename, prepare_pages,
    render_pdf, sanitize_svg,
)

PAGE = ('<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid meet">'
        '<rect x="0" y="0" width="1200" height="800" fill="#ffffff"/>'
        '<path d="M 10.00 10.00 Q 20 20 30 30 Z" fill="#dc2626" opacity="0.35"/>'
        '<line x1="1" y1="2" x2="3" y2="4" stroke="#cbd5e1" stroke-width="1"/>'
        '<text x="5" y="6" text-anchor="middle" font-size="13" font-weight="600" '
        'fill="#94a3b8" font-family="system-ui, sans-serif">46</text></svg>')


def _wrap(inner):
    return f'<svg viewBox="0 0 1200 800">{inner}</svg>'


# ─── What survives ───────────────────────────────────────────────────────────

def test_a_real_page_keeps_everything_it_draws():
    out = sanitize_svg(PAGE)
    for kept in ('<rect', '<path', '<line', '<text', 'fill="#dc2626"',
                 'opacity="0.35"', 'M 10.00 10.00 Q 20 20 30 30 Z', '>46<'):
        assert kept in out


def test_what_react_adds_for_the_screen_is_dropped():
    out = sanitize_svg(
        '<svg viewBox="0 0 1200 800" role="img" aria-label="x" class="block h-full" '
        'style="pointer-events:none"><rect x="0" y="0" width="10" height="10" fill="#fff"/></svg>')
    for gone in ('role=', 'aria-label', 'class=', 'style='):
        assert gone not in out


# ─── What never survives ─────────────────────────────────────────────────────

@pytest.mark.parametrize('hostile', [
    '<image href="file:///etc/passwd" width="10" height="10"/>',
    '<image xlink:href="http://169.254.169.254/latest/meta-data/" '
    'xmlns:xlink="http://www.w3.org/1999/xlink"/>',
    '<use href="#x"/>',
    '<foreignObject><p>hi</p></foreignObject>',
    '<script>alert(1)</script>',
    '<style>@import url(http://evil.test/x.css);</style>',
    '<a href="javascript:alert(1)"><rect x="0" y="0" width="1" height="1"/></a>',
    '<feImage href="file:///etc/hosts"/>',
])
def test_elements_that_can_reach_out_are_never_copied(hostile):
    out = sanitize_svg(_wrap(hostile))
    for word in ('image', 'href', 'use', 'foreignObject', 'script', 'style',
                 'javascript', 'etc/passwd', '169.254', 'evil.test', 'feImage'):
        assert word not in out


@pytest.mark.parametrize('attr', [
    'fill="url(http://evil.test/x)"',
    'fill="url(#gradient)"',
    'fill="expression(alert(1))"',
    'onclick="alert(1)"',
    'onload="alert(1)"',
    'style="fill:url(http://evil.test)"',
    'width="10; background:url(x)"',
    'filter="url(http://evil.test/f)"',
])
def test_attribute_values_are_checked_not_trusted(attr):
    # The base rect leaves out whichever attribute is under test, so the
    # fixture is well-formed XML and the value check is what is exercised.
    base = {'x': '0', 'y': '0', 'width': '10', 'height': '10'}
    base.pop(attr.split('=', 1)[0], None)
    fixed = ' '.join(f'{k}="{v}"' for k, v in base.items())
    out = sanitize_svg(_wrap(f'<rect {fixed} {attr}/>'))
    assert 'url(' not in out and 'alert' not in out and 'expression' not in out
    assert 'evil' not in out


def test_a_path_with_anything_but_geometry_is_emptied_of_it():
    out = sanitize_svg(_wrap('<path d="M 0 0 javascript:alert(1)" fill="#000"/>'))
    assert 'javascript' not in out
    assert ' d=' not in out


def test_text_cannot_become_markup():
    out = sanitize_svg(_wrap('<text x="1" y="1">&lt;image href="file:///x"/&gt;</text>'))
    assert '<image' not in out
    assert '&lt;' in out


def test_text_is_capped():
    out = sanitize_svg(_wrap(f'<text x="1" y="1">{"9" * 500}</text>'))
    assert '9' * 41 not in out


@pytest.mark.parametrize('markup', [
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg viewBox="0 0 1 1"><text>&x;</text></svg>',
    '<!DOCTYPE svg><svg viewBox="0 0 1 1"/>',
    '<html><body/></html>',
    '<svg viewBox="0 0 1 1"><unclosed></svg>',
    '<svg><rect/></svg>',       # no viewBox survives: not a page we drew
    '',
    '   ',
])
def test_anything_that_is_not_a_plain_page_is_refused(markup):
    with pytest.raises(SketchRejected):
        sanitize_svg(markup)


def test_a_billion_laughs_is_refused_before_it_is_parsed():
    bomb = ('<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">'
            '<!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]>'
            '<svg viewBox="0 0 1 1"><text>&lol2;</text></svg>')
    with pytest.raises(SketchRejected):
        sanitize_svg(bomb)


def test_oversized_pages_are_refused(monkeypatch):
    monkeypatch.setattr(sketch_pdf, 'MAX_SVG_BYTES', 100)
    with pytest.raises(SketchRejected):
        sanitize_svg(PAGE)


def test_a_page_with_too_many_elements_is_refused(monkeypatch):
    monkeypatch.setattr(sketch_pdf, 'MAX_ELEMENTS', 3)
    with pytest.raises(SketchRejected):
        sanitize_svg(PAGE)


# ─── The request as a whole ──────────────────────────────────────────────────

@pytest.mark.parametrize('pages', [[], None, 'svg', {}])
def test_nothing_to_export_is_refused(pages):
    with pytest.raises(SketchRejected):
        prepare_pages(pages)


def test_too_many_pages_is_refused():
    with pytest.raises(SketchRejected):
        prepare_pages([PAGE] * (MAX_PAGES + 1))


def test_every_export_gets_its_own_storage_name():
    """Storage keys are the filename with nothing added, so two exports of the
    same visit would otherwise overwrite each other."""
    paper = NS(date=datetime.datetime(2026, 6, 3, 10, 0))
    names = {export_filename(paper) for _ in range(50)}
    assert len(names) == 50
    assert all(n.startswith('pen-notes-2026-06-03-') and n.endswith('.pdf') for n in names)


# ─── The render itself ───────────────────────────────────────────────────────

def _doc(pages):
    return build_html(
        pages,
        clinic=NS(name='Royal <Smile>', timezone='Asia/Kolkata'),
        patient=NS(name='Asha & Co', display_id='PT-7', age=34, gender='female', id=7),
        paper=NS(date=datetime.datetime(2026, 6, 3, 18, 30)),
        doctor_name='Dr <b>Rao</b>',
    )


def test_the_header_is_escaped():
    html = _doc([sanitize_svg(PAGE)])
    assert 'Royal &lt;Smile&gt;' in html
    assert 'Asha &amp; Co' in html
    assert '<b>Rao</b>' not in html


def test_the_visit_date_is_the_clinics_day():
    """18:30 UTC is already the next morning in India."""
    assert '04 Jun 2026' in _doc([sanitize_svg(PAGE)])


def test_one_sheet_per_page_numbered():
    html = _doc([sanitize_svg(PAGE)] * 3)
    assert 'Page 1 of 3' in html and 'Page 3 of 3' in html


def test_it_renders_a_pdf():
    pdf = render_pdf(_doc([sanitize_svg(PAGE)]))
    assert pdf.startswith(b'%PDF-')
    assert len(pdf) > 1000


def test_the_renderer_never_fetches_a_url(monkeypatch):
    """Belt and braces: even HTML that DOES reference a URL — a mistake in the
    allowlist, say — must not reach the network or the disk."""
    import weasyprint.urls

    def boom(*a, **k):
        raise AssertionError('the default URL fetcher must never be used')

    monkeypatch.setattr(weasyprint.urls, 'default_url_fetcher', boom)
    fetched = []
    real = sketch_pdf._refuse_urls

    def spy(url, *a, **k):
        fetched.append(url)
        return real(url, *a, **k)

    monkeypatch.setattr(sketch_pdf, '_refuse_urls', spy)
    html = ('<html><body><img src="http://169.254.169.254/latest/meta-data/">'
            '<img src="file:///etc/passwd"></body></html>')
    pdf = render_pdf(html)
    assert pdf.startswith(b'%PDF-')
    assert fetched, 'the refusing fetcher should have been asked'


def test_the_refusing_fetcher_refuses():
    with pytest.raises(ValueError):
        sketch_pdf._refuse_urls('file:///etc/passwd')
