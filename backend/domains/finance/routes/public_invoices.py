"""What the QR code on a printed bill opens.

Unauthenticated by design, and held to the same three rules as the public
medical-history forms (domains/forms/routes/public_forms.py):

  * The token is the only lookup key. Nothing here accepts an invoice id, so
    there is no id to walk.
  * A token that does not exist and a token whose clinic has switched the QR
    off get the identical 404, word for word. Otherwise the endpoint would
    answer "that token is real, you just can't see it", which is exactly what
    someone guessing tokens wants to know.
  * The summary carries the patient's first name only. The PDF is the bill
    itself and carries what the bill carries — that is the point of it, and the
    person holding the paper already has every word of it.

The clinic's QR setting is checked on every request, not just when the code is
printed. That makes it a live kill switch: a clinic that decides it no longer
wants bills viewable online turns it off, and every code it ever printed stops
working at that moment.
"""
import os

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Invoice, Clinic, Patient, TemplateConfiguration
from domains.finance.invoice_pdf_engine import generate_invoice_html
from domains.infrastructure.services.pdf_fields import resolve_qr_enabled
from domains.infrastructure.services.pdf_service import html_template_to_pdf

router = APIRouter()

_NOT_FOUND = "This invoice link is not valid, or the clinic has turned it off."

# A patient bill must never be cached by a proxy or indexed by a search engine,
# even if a link to it ends up somewhere public.
_PRIVATE_HEADERS = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Referrer-Policy": "no-referrer",
}


def _load(db: Session, token: str):
    """The invoice, its clinic and its template config, or the one 404."""
    # Cheap shape check first. Real tokens are 22 url-safe characters; anything
    # that is not the right shape cannot be one, and need not cost a query.
    if not token or len(token) > 64:
        raise HTTPException(404, _NOT_FOUND)

    invoice = db.query(Invoice).filter(Invoice.public_token == token).first()
    if not invoice or (invoice.status or "").lower() in ("draft", "cancelled"):
        raise HTTPException(404, _NOT_FOUND)

    config = db.query(TemplateConfiguration).filter(
        TemplateConfiguration.clinic_id == invoice.clinic_id,
        TemplateConfiguration.category == "invoice",
    ).first()
    if not resolve_qr_enabled(config):
        raise HTTPException(404, _NOT_FOUND)

    clinic = db.query(Clinic).filter(Clinic.id == invoice.clinic_id).first()
    return invoice, clinic, config


@router.get("/{token}")
def public_invoice_summary(token: str, db: Session = Depends(get_db)):
    """Enough for the page to say whose bill this is before it is opened."""
    invoice, clinic, _ = _load(db, token)
    patient = db.query(Patient).filter(Patient.id == invoice.patient_id).first()
    first_name = ((patient.name if patient else "") or "").strip().split(" ")[0]

    total = float(invoice.total or 0)
    due = float(invoice.due_amount or 0)
    return JSONResponse(
        content={
            "clinic_name": getattr(clinic, "name", None) or "",
            "clinic_phone": getattr(clinic, "phone", None) or "",
            "currency_symbol": getattr(clinic, "currency_symbol", None) or "₹",
            "invoice_number": invoice.invoice_number,
            "date": (invoice.finalized_at or invoice.created_at).date().isoformat()
                    if (invoice.finalized_at or invoice.created_at) else None,
            "total": round(total, 2),
            "due": round(due, 2),
            "paid": due <= 0,
            "patient_first_name": first_name,
        },
        headers=_PRIVATE_HEADERS,
    )


@router.get("/{token}/pdf")
def public_invoice_pdf(token: str, db: Session = Depends(get_db)):
    """The bill itself, inline, so a phone opens it in its own PDF viewer."""
    invoice, clinic, config = _load(db, token)
    html = generate_invoice_html(invoice, clinic, config)
    path = html_template_to_pdf(html)
    try:
        with open(path, "rb") as fh:
            pdf = fh.read()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            **_PRIVATE_HEADERS,
            "Content-Disposition": f'inline; filename="invoice_{invoice.invoice_number}.pdf"',
        },
    )
