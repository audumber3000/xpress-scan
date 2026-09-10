"""The bits of every email that are not the message: header, logo, buttons.

All three were broken at once, and the symptom was one screenshot: a solid dark
band with nothing in it, above a teal button with blue text.

  * the logo URL (molarplus.com/molarplus-logo-transparent.svg) did not resolve
  * it was an SVG, which Gmail, Outlook, Yahoo and Apple Mail all strip
  * it was whitened with `filter:brightness(0) invert(1)`, a CSS filter no mail
    client supports
  * the button's white text came from a class, and clients inject their own
    `a{color:...}` which beat it

These pin the fixes rather than the appearance.
"""
import re

import pytest

from app.services.infrastructure import email_templates as T


PLATFORM_SAMPLES = [
    ("welcome", dict(owner_name="Dr Sharma", clinic_name="Sharma Dental Clinic")),
    ("molarplus_app_welcome", dict(owner_name="Dr Sharma", clinic_name="Sharma Dental Clinic")),
    ("staff_invitation", dict(staff_name="Priya", clinic_name="Sharma Dental Clinic",
                              role="Receptionist", email="p@c.com", username="reception1",
                              password="willow-quartz-42", login_url="https://app.molarplus.com")),
]


def _html(event, kwargs):
    return T.build_email(event, **kwargs)["html"]


@pytest.mark.parametrize("event,kwargs", PLATFORM_SAMPLES)
def test_the_brand_is_readable_without_loading_a_single_image(event, kwargs):
    """The header must say MolarPlus even with images off, which is the default
    in Outlook and a common Gmail setting."""
    html = _html(event, kwargs)
    stripped = re.sub(r"<img[^>]*>", "", html)
    assert "MolarPlus" in stripped


@pytest.mark.parametrize("event,kwargs", PLATFORM_SAMPLES)
def test_no_svg_and_no_css_filter_anywhere(event, kwargs):
    """Two things that silently render as nothing in email."""
    html = _html(event, kwargs)
    assert ".svg" not in html, "an SVG image will not render in email"
    assert "filter:brightness" not in html, "CSS filters do not apply in email"


@pytest.mark.parametrize("event,kwargs", PLATFORM_SAMPLES)
def test_the_header_wordmark_is_white_on_the_dark_band(event, kwargs):
    html = _html(event, kwargs)
    header = html[html.index('class="header"'):]
    header = header[:header.index("</div>")]
    assert T.BRAND_DARK in header, "the header lost its dark band"
    assert "#ffffff" in header, "the wordmark is not white, so it vanishes on the band"


@pytest.mark.parametrize("event,kwargs", PLATFORM_SAMPLES)
def test_every_button_carries_its_white_inline(event, kwargs):
    """A class is not enough: several clients inject `a{color:...}` that beats
    it, which is how a white-on-brand button arrived with blue text."""
    html = _html(event, kwargs)
    for match in re.finditer(r'<a\b[^>]*class="btn"[^>]*>', html):
        tag = match.group(0)
        assert "color:#ffffff" in tag, f"button without inline white: {tag}"


def test_the_palette_is_the_apps_own():
    """#2a276e is the primary the app uses 1426 times; the email led with the
    teal accent instead."""
    assert T.BRAND_COLOR == "#2a276e"
    assert T.ACCENT_COLOR == "#29828a"
    # Other modules imported DARK_COLOR by name before the rename.
    assert T.DARK_COLOR == T.BRAND_DARK


def test_no_flexbox_in_any_header():
    """Outlook renders with Word, which has neither flex nor gap."""
    # Both branches of the clinic header: with a logo, and with the initial
    # badge that stands in when a clinic has not uploaded one.
    for logo in ("https://cdn.example.com/clinic.png", ""):
        header = T._clinic_header("Sharma Dental Clinic", logo)
        assert "display:flex" not in header
        assert "display:inline-flex" not in header
        assert "<table" in header, "the header needs a table to lay out in Outlook"


def test_a_configured_png_is_used_and_still_degrades(monkeypatch):
    """When a real PNG is published the image leads — but its alt text stays
    white, so a blocked image reads as the brand, not a broken icon."""
    monkeypatch.setattr(T, "MOLARPLUS_LOGO_URL", "https://cdn.example.com/logo.png")
    header = T._platform_header()
    assert "https://cdn.example.com/logo.png" in header
    assert 'alt="MolarPlus"' in header
    assert "color:#ffffff" in header


# ── WhatsApp: no parameter may ever be empty ────────────────────────────────

@pytest.mark.parametrize("kwargs", [
    {},
    {"staff_name": "Priya"},
    {"clinic_name": "Sharma Dental Clinic"},
    {"staff_name": "Priya", "clinic_name": "C", "role": "Receptionist",
     "email": "p@c.com", "username": "reception1", "password": "willow-quartz-42",
     "app_url": "https://app.molarplus.com"},
])
def test_no_whatsapp_body_parameter_is_ever_blank(kwargs):
    """Meta rejects a body parameter that is empty or whitespace-only, and the
    rejection is per-message: one unset env var on one deployment silently
    kills every staff invitation on it. {{7}} fell through exactly that way
    when neither app_url nor clinic_phone was configured.
    """
    from app.services.infrastructure.whatsapp_templates import wa_staff_welcome

    out = wa_staff_welcome(**kwargs)
    params = out["components"][0]["parameters"]
    assert len(params) == 5, "the LIVE approved template expects five body params"
    for i, p in enumerate(params, 1):
        assert p["text"].strip(), f"{{{{{i}}}}} is blank with kwargs={kwargs}"


def test_the_password_never_goes_out_on_whatsapp():
    """Meta rejected the seven-param version outright: a credential makes it an
    Authentication template, and those take a fixed one-code body that cannot
    also carry an email, a username and a link.

    The caller still passes a password, because one payload feeds both channels
    and the email needs it. This asserts the WhatsApp builder drops it on the
    floor."""
    from app.services.infrastructure.whatsapp_templates import wa_staff_welcome

    out = wa_staff_welcome(
        staff_name="Priya", clinic_name="C", role="Receptionist",
        email="p@c.com", username="reception1",
        password="willow-quartz-42", app_url="https://app.molarplus.com",
    )
    rendered = " ".join(p["text"] for p in out["components"][0]["parameters"])
    assert "willow-quartz-42" not in rendered
