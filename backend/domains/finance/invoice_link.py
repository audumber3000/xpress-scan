"""The link-to-invoice QR code: its token, its URL, and its image.

A patient scans the code on a printed bill and their phone opens that invoice.
No login — the token in the URL is the credential, exactly as it is for the
public medical-history forms, and the same rules hold (see
domains/forms/routes/public_forms.py):

  * the token is the only lookup key, never an invoice id;
  * a wrong token and a clinic that has switched the QR off get the same 404,
    so the endpoint cannot be used to learn which tokens exist.

Unlike a form link it does not expire. It is printed on paper that lives in a
drawer for years, and a code that stops working after a month is worse than no
code. The clinic's QR setting is the kill switch instead: turning it off stops
every link that clinic has ever printed, which is the right behaviour for a
clinic deciding it no longer wants bills viewable online.

─── The URL is on the web app's domain, deliberately ────────────────────

FRONTEND_URL, not BACKEND_URL. The API host has already moved once (Hetzner to
AWS) and a printed code has to survive the next move too; the app's domain is
the part that stays put. It is also shorter, and a shorter URL encodes to a
sparser code that still scans when printed small.

It must be the APP domain (app.molarplus.com), not the marketing site
(molarplus.com). The /i/:token page is a route in the web app, and molarplus.com
404s it. Production sets FRONTEND_URL=https://app.molarplus.com; the fallback
below matches it, so an environment that forgets the variable still prints
codes that open.
"""
import base64
import io
import os
import secrets

import qrcode
from qrcode.constants import ERROR_CORRECT_M

# 16 bytes, ~128 bits: far past guessable, and 22 characters of URL.
_TOKEN_BYTES = 16


def ensure_public_token(db, invoice) -> str:
    """The invoice's token, minting and saving one if it has none.

    Commits, because the caller is about to print this token onto a document.
    A token that exists in the PDF but was never persisted is a QR code that
    scans to a 404, which is the one outcome this whole feature must not have.
    """
    if getattr(invoice, 'public_token', None):
        return invoice.public_token
    invoice.public_token = secrets.token_urlsafe(_TOKEN_BYTES)
    db.commit()
    return invoice.public_token


def public_invoice_url(token: str) -> str:
    base = os.getenv('FRONTEND_URL', 'https://app.molarplus.com').rstrip('/')
    return f'{base}/i/{token}'


def qr_data_uri(url: str) -> str:
    """A PNG data URI for `url`, sized to print sharp at ~20mm.

    PNG rather than SVG on purpose: pdf_safety rejects SVG images because
    WeasyPrint will execute script inside SVG in some configurations. This
    image is generated here from a URL we built, so the risk is small, but the
    rule is simpler to keep than to argue exceptions to.

    Error correction M (~15%) survives a crease or a thumbprint on a printed
    bill without making the code noticeably denser than L would.
    """
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=10, border=0)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color='#111827', back_color='white')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
