"""The consent language library and formatted (HTML) consent wording."""
import pytest

from domains.consent.library import LANGUAGES, FORM_KEYS, library_forms, library_form
from domains.consent.rich_content import is_html, sanitize, clean_for_storage
from domains.consent.consent_templates import resolve_variant
from domains.infrastructure.services.preview_samples import sample_clinic


# ── Library ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("code", [lang["code"] for lang in LANGUAGES])
def test_every_language_has_all_six_forms(code):
    forms = library_forms(code)
    assert [f["key"] for f in forms] == FORM_KEYS
    for f in forms:
        assert f["language"] == code
        assert f["name"].strip()
        # Plain text, like the English starters: the renderer escapes it.
        assert not is_html(f["content"])
        assert len(f["content"].splitlines()) >= 5


def test_library_names_are_unique_across_languages():
    names = [f["name"] for lang in LANGUAGES for f in library_forms(lang["code"])]
    assert len(names) == len(set(names))


def test_unknown_language_and_key():
    assert library_forms("xx") == []
    assert library_form("hi", "nope") is None
    assert library_form("hi", "endodontic")["category"] == "endodontic"


# ── Detecting formatted wording ───────────────────────────────────────────

def test_plain_text_is_not_html():
    assert not is_html("I consent to treatment.\nSecond paragraph.")
    assert not is_html("Use <b> for bold")  # does not START with a block tag
    assert not is_html("")
    assert not is_html(None)


def test_editor_output_is_html():
    assert is_html("<p>Hello</p>")
    assert is_html("  <h2>Title</h2><p>x</p>")
    assert is_html("<table><tr><td>36</td></tr></table>")


def test_plain_text_is_stored_untouched():
    text = "Line one <3\nLine two & more"
    assert clean_for_storage(text) == text


# ── Sanitising ────────────────────────────────────────────────────────────

def test_scripts_and_handlers_are_stripped():
    dirty = (
        '<p onclick="alert(1)">Hi<script>alert(2)</script></p>'
        '<img src=x onerror="alert(3)">'
        '<a href="javascript:alert(4)">link</a>'
        '<iframe src="https://evil"></iframe>'
        '<style>p{color:red}</style>'
    )
    out = sanitize(dirty)
    for bad in ("script", "onclick", "onerror", "javascript", "iframe", "<img", "<a", "<style", "alert(2)"):
        assert bad not in out.lower()
    assert "<p>Hi</p>" in out
    assert "link" in out  # text of an unwrapped tag survives


def test_style_is_allowlisted():
    out = sanitize(
        '<p style="text-align: center; color: #ff0000; background-image: url(x); position: fixed">x</p>'
    )
    assert 'text-align: center' in out
    assert 'color: #ff0000' in out
    assert 'url' not in out
    assert 'position' not in out


def test_formatting_survives():
    html = (
        '<h2>Consent</h2><p><strong>Bold</strong> <em>it</em> <u>u</u> <s>s</s></p>'
        '<ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol>'
        '<table><tbody><tr><th colspan="2">T</th></tr><tr><td>a</td><td>b</td></tr></tbody></table>'
        '<hr><p><mark style="background-color: #fef08a">hi</mark></p>'
    )
    out = sanitize(html)
    for tag in ("<h2>", "<strong>", "<em>", "<u>", "<s>", "<ul>", "<ol>", "<li>",
                "<table>", '<th colspan="2">', "<td>", "<hr>", "<mark"):
        assert tag in out


def test_text_is_escaped_and_output_balanced():
    out = sanitize("<p>1 < 2 & 3 > 2<strong>unclosed</p>")
    assert "1 &lt; 2 &amp; 3 &gt; 2" in out
    assert out.count("<strong>") == out.count("</strong>")
    assert out.count("<p>") == out.count("</p>")


def test_indic_text_survives_sanitising():
    out = sanitize("<p>रूट कैनाल उपचार के लिए सहमति</p>")
    assert "रूट कैनाल उपचार के लिए सहमति" in out


# ── Rendering ─────────────────────────────────────────────────────────────

def _render(content):
    return resolve_variant("classic")["render"](
        sample_clinic(), "Asha", 7, "Consent", content, "", None
    )


def test_rendered_html_content_keeps_formatting_and_drops_scripts():
    html = _render('<h2>Risks</h2><ul><li><p>Swelling</p></li></ul><script>alert(1)</script>')
    assert '<div class="rich"><h2>Risks</h2>' in html
    assert "<li><p>Swelling</p></li>" in html
    assert "alert(1)" not in html
    assert ".rich table" in html


def test_rendered_plain_content_is_escaped_paragraphs():
    html = _render("First line\n<b>not bold</b>")
    assert "<p>First line</p>" in html
    assert "<p>&lt;b&gt;not bold&lt;/b&gt;</p>" in html
    assert 'class="rich"' not in html


# ── Endpoints ─────────────────────────────────────────────────────────────

def test_library_lists_a_language_and_marks_what_the_clinic_has(client, auth_headers):
    r = client.get("/api/v1/consents/library?language=ta", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert [lang["code"] for lang in body["languages"]] == ["en", "hi", "mr", "te", "ta", "kn", "gu"]
    assert len(body["forms"]) == 6
    assert not any(f["added"] for f in body["forms"])

    assert client.get("/api/v1/consents/library?language=xx", headers=auth_headers).status_code == 400


def test_add_from_library_is_starred_and_idempotent(client, auth_headers):
    payload = {"language": "hi", "key": "endodontic"}
    first = client.post("/api/v1/consents/library/add", json=payload, headers=auth_headers)
    assert first.status_code == 200, first.text
    row = first.json()
    assert row["language"] == "hi"
    assert row["is_favorite"] is True
    assert row["category"] == "endodontic"

    again = client.post("/api/v1/consents/library/add", json=payload, headers=auth_headers).json()
    assert again["id"] == row["id"]

    lib = client.get("/api/v1/consents/library?language=hi", headers=auth_headers).json()
    assert [f["added"] for f in lib["forms"] if f["key"] == "endodontic"] == [True]


def test_favorite_toggle(client, auth_headers):
    created = client.post(
        "/api/v1/consents/templates",
        json={"name": "Whitening", "content": "Plain text."},
        headers=auth_headers,
    ).json()
    assert created["is_favorite"] is False
    assert created["language"] == "en"

    r = client.patch(f"/api/v1/consents/templates/{created['id']}/favorite",
                     json={"is_favorite": True}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_favorite"] is True


def test_html_content_is_sanitised_on_save(client, auth_headers):
    created = client.post(
        "/api/v1/consents/templates",
        json={"name": "Rich", "content": "<p>Hi<script>x()</script></p>", "language": "mr"},
        headers=auth_headers,
    ).json()
    assert created["content"] == "<p>Hi</p>"
    assert created["language"] == "mr"

    updated = client.put(
        f"/api/v1/consents/templates/{created['id']}",
        json={"content": '<h2 onclick="x">T</h2><p>ok</p>'},
        headers=auth_headers,
    ).json()
    assert updated["content"] == "<h2>T</h2><p>ok</p>"


def test_create_without_new_fields_still_works(client, auth_headers):
    """Mobile sends only name + content; it must keep working unchanged."""
    r = client.post("/api/v1/consents/templates",
                    json={"name": "Old client", "content": "Line\nLine"}, headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.json()["content"] == "Line\nLine"
    assert r.json()["is_active"] is True
