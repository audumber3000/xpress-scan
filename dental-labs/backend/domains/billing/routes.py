"""
Billing routes — monthly statements, invoices, payments, outstanding.
"""
import base64
import datetime
import os
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract

from database import get_db
from core.auth import get_current_user, require_role
from models import LabUser, Lab, Case, Client, Invoice, InvoiceLineItem, Payment
from schemas.billing import (
    StatementGenerateRequest, InvoiceResponse, InvoiceLineItemResponse,
    PaymentCreateRequest, PaymentResponse, OutstandingResponse,
)
from domains.billing.pdf import render_pdf
from domains.billing.statement_template import render_statement_html
from domains.notification.dispatcher import notify_lab_event

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

router = APIRouter()


@router.post("/statements/generate")
def generate_statement(
    body: StatementGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: LabUser = Depends(require_role("lab_owner")),
):
    """Generate a monthly statement (invoice) for a client."""
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    # Verify client
    client = db.query(Client).filter(
        Client.id == body.client_id,
        Client.lab_id == user.lab_id,
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Get delivered, NOT-yet-invoiced cases whose delivery falls in the period.
    # Keying on delivered_at (not received_date) bills work in the month it shipped;
    # the invoice_id IS NULL guard makes regeneration idempotent — no double-billing.
    period_end_dt = datetime.datetime.combine(body.period_end, datetime.time.max)
    cases = db.query(Case).filter(
        Case.client_id == body.client_id,
        Case.lab_id == user.lab_id,
        Case.status == "delivered",
        Case.invoice_id.is_(None),
        Case.delivered_at.isnot(None),
        Case.delivered_at >= body.period_start,
        Case.delivered_at <= period_end_dt,
    ).all()

    if not cases:
        raise HTTPException(
            status_code=400,
            detail="No un-invoiced delivered cases in this period",
        )

    # Generate invoice number
    year = body.period_end.year
    count = db.query(func.count(Invoice.id)).filter(
        Invoice.lab_id == user.lab_id,
        extract("year", Invoice.created_at) == year,
    ).scalar()
    seq = (count or 0) + 1
    invoice_number = f"INV-{year}-{seq:04d}"

    # Calculate totals
    subtotal = sum(c.total_amount for c in cases)
    tax_amount = round(subtotal * body.tax_rate / 100, 2)
    total = round(subtotal + tax_amount, 2)

    invoice = Invoice(
        lab_id=user.lab_id,
        client_id=body.client_id,
        invoice_number=invoice_number,
        period_start=body.period_start,
        period_end=body.period_end,
        subtotal=subtotal,
        tax_rate=body.tax_rate,
        tax_amount=tax_amount,
        total=total,
        paid_amount=0.0,
        due_amount=total,
        status="draft",
    )
    db.add(invoice)
    db.flush()

    # Create line items from cases and mark each case as billed by this invoice
    invoiced_at = datetime.datetime.utcnow()
    for case in cases:
        line = InvoiceLineItem(
            invoice_id=invoice.id,
            case_id=case.id,
            description=f"Case {case.case_number} — {case.patient_name or 'N/A'}",
            qty=1,
            unit_price=case.total_amount,
            amount=case.total_amount,
        )
        db.add(line)
        case.invoice_id = invoice.id
        case.invoiced_at = invoiced_at

    db.commit()
    db.refresh(invoice)

    # Reload with line items
    invoice = db.query(Invoice).options(
        joinedload(Invoice.line_items),
    ).filter(Invoice.id == invoice.id).first()

    # Notify the dentist that their statement is ready, with the PDF attached.
    lab = db.query(Lab).filter(Lab.id == user.lab_id).first()
    period_label = f"{body.period_start:%d %b}–{body.period_end:%d %b %Y}"
    amount_str = f"{lab.currency_symbol}{total:,.2f}" if lab else f"{total:,.2f}"
    extra = {"period_label": period_label, "amount": amount_str}
    try:
        pdf_bytes = render_pdf(render_statement_html(invoice, lab, client))
        extra["attachments"] = [{
            "name": f"Statement_{invoice_number}.pdf",
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
            "mime_type": "application/pdf",
        }]
    except Exception:
        # PDF is best-effort — still send the statement-ready notice without it.
        pass
    background_tasks.add_task(
        notify_lab_event,
        event_type="statement_ready",
        lab_id=user.lab_id,
        client_id=body.client_id,
        extra=extra,
    )

    return {"invoice": _invoice_to_response(invoice, client.name)}


@router.get("/statements")
def list_invoices(
    client_id: int = Query(default=None),
    status: str = Query(default=None),
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    query = db.query(Invoice).options(
        joinedload(Invoice.line_items),
        joinedload(Invoice.client),
    ).filter(Invoice.lab_id == user.lab_id)

    if client_id:
        query = query.filter(Invoice.client_id == client_id)
    if status:
        query = query.filter(Invoice.status == status)

    invoices = query.order_by(Invoice.created_at.desc()).all()

    result = [_invoice_to_response(inv, inv.client.name if inv.client else None)
              for inv in invoices]

    return {"invoices": result, "total": len(result)}


@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    invoice = db.query(Invoice).options(
        joinedload(Invoice.line_items),
    ).filter(
        Invoice.id == invoice_id,
        Invoice.lab_id == user.lab_id,
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    client = db.query(Client).filter(Client.id == invoice.client_id).first()
    return {"invoice": _invoice_to_response(invoice, client.name if client else None)}


@router.delete("/invoices/{invoice_id}")
def void_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(require_role("lab_owner")),
):
    """Void a draft/sent invoice so it can be regenerated.

    Unlinks its cases (back to un-invoiced) and deletes its line items. Blocked once
    any payment has been recorded against it, to protect the audit trail.
    """
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.lab_id == user.lab_id,
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status not in ("draft", "sent"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot void an invoice with status '{invoice.status}'",
        )

    if invoice.paid_amount and invoice.paid_amount > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot void an invoice that has payments recorded",
        )

    # Release the cases so they can be billed again
    db.query(Case).filter(Case.invoice_id == invoice.id).update(
        {Case.invoice_id: None, Case.invoiced_at: None},
        synchronize_session=False,
    )

    # Remove the generated PDF if present
    if invoice.pdf_path and os.path.exists(invoice.pdf_path):
        try:
            os.remove(invoice.pdf_path)
        except OSError:
            pass

    db.delete(invoice)  # cascades to line_items
    db.commit()
    return {"message": "Invoice voided", "invoice_id": invoice_id}


@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    """Render (and cache) the branded statement PDF and stream it inline."""
    invoice = db.query(Invoice).options(
        joinedload(Invoice.line_items),
    ).filter(
        Invoice.id == invoice_id,
        Invoice.lab_id == user.lab_id,
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    filename = f"{invoice.invoice_number}.pdf"

    # Serve cached PDF if still on disk
    if invoice.pdf_path and os.path.exists(invoice.pdf_path):
        return FileResponse(
            invoice.pdf_path, media_type="application/pdf", filename=filename,
        )

    lab = db.query(Lab).filter(Lab.id == invoice.lab_id).first()
    client = db.query(Client).filter(Client.id == invoice.client_id).first()

    html = render_statement_html(invoice, lab, client)
    pdf_bytes = render_pdf(html)

    statements_dir = os.path.join(UPLOAD_DIR, "statements")
    os.makedirs(statements_dir, exist_ok=True)
    pdf_path = os.path.join(statements_dir, filename)
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)

    invoice.pdf_path = pdf_path
    db.commit()

    return FileResponse(pdf_path, media_type="application/pdf", filename=filename)


# ── Payments ────────────────────────────────────────────────────────────

@router.post("/payments")
def record_payment(
    body: PaymentCreateRequest,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    payment = Payment(
        lab_id=user.lab_id,
        client_id=body.client_id,
        invoice_id=body.invoice_id,
        amount=body.amount,
        method=body.method,
        reference_number=body.reference_number,
        paid_at=body.paid_at or datetime.datetime.utcnow(),
        notes=body.notes,
    )
    db.add(payment)

    # Update invoice if linked
    if body.invoice_id:
        invoice = db.query(Invoice).filter(
            Invoice.id == body.invoice_id,
            Invoice.lab_id == user.lab_id,
        ).first()
        if invoice:
            invoice.paid_amount = round(invoice.paid_amount + body.amount, 2)
            invoice.due_amount = round(invoice.total - invoice.paid_amount, 2)
            if invoice.due_amount <= 0:
                invoice.status = "paid"
                invoice.due_amount = 0
            else:
                invoice.status = "partially_paid"

    db.commit()
    db.refresh(payment)

    client = db.query(Client).filter(Client.id == payment.client_id).first()
    return {"payment": _payment_to_response(payment, client.name if client else None)}


@router.get("/payments")
def list_payments(
    client_id: int = Query(default=None),
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    query = db.query(Payment).filter(Payment.lab_id == user.lab_id)
    if client_id:
        query = query.filter(Payment.client_id == client_id)

    payments = query.order_by(Payment.paid_at.desc()).all()
    result = []
    for p in payments:
        client = db.query(Client).filter(Client.id == p.client_id).first()
        result.append(_payment_to_response(p, client.name if client else None))

    return {"payments": result, "total": len(result)}


# ── Outstanding ─────────────────────────────────────────────────────────

@router.get("/outstanding")
def get_outstanding(
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    # Single source of truth: outstanding = sum of due_amount on live invoices.
    # `unbilled` (delivered work not yet on a statement) is reported separately so the
    # lab can see what's ready to bill, without conflating it with money actually owed.
    invoice_rows = db.query(
        Invoice.client_id,
        func.coalesce(func.sum(Invoice.total), 0.0).label("billed"),
        func.coalesce(func.sum(Invoice.paid_amount), 0.0).label("paid"),
        func.coalesce(func.sum(Invoice.due_amount), 0.0).label("outstanding"),
    ).filter(
        Invoice.lab_id == user.lab_id,
        Invoice.status != "cancelled",
    ).group_by(Invoice.client_id).all()

    unbilled_rows = db.query(
        Case.client_id,
        func.coalesce(func.sum(Case.total_amount), 0.0).label("unbilled"),
    ).filter(
        Case.lab_id == user.lab_id,
        Case.status == "delivered",
        Case.invoice_id.is_(None),
    ).group_by(Case.client_id).all()
    unbilled_by_client = {r.client_id: float(r.unbilled) for r in unbilled_rows}

    client_ids = set(r.client_id for r in invoice_rows) | set(unbilled_by_client)
    clients = {
        c.id: c.name
        for c in db.query(Client.id, Client.name).filter(Client.id.in_(client_ids)).all()
    } if client_ids else {}

    result = []
    for r in invoice_rows:
        outstanding = round(float(r.outstanding), 2)
        unbilled = round(unbilled_by_client.pop(r.client_id, 0.0), 2)
        if outstanding > 0 or unbilled > 0:
            result.append({
                "client_id": r.client_id,
                "client_name": clients.get(r.client_id),
                "total_billed": round(float(r.billed), 2),
                "total_paid": round(float(r.paid), 2),
                "outstanding": outstanding,
                "unbilled": unbilled,
            })

    # Clients with only un-invoiced delivered work (no invoices yet)
    for client_id, unbilled in unbilled_by_client.items():
        unbilled = round(unbilled, 2)
        if unbilled > 0:
            result.append({
                "client_id": client_id,
                "client_name": clients.get(client_id),
                "total_billed": 0.0,
                "total_paid": 0.0,
                "outstanding": 0.0,
                "unbilled": unbilled,
            })

    result.sort(key=lambda x: (x["outstanding"], x["unbilled"]), reverse=True)
    return {"outstanding": result, "total": len(result)}


@router.get("/clients/{client_id}/unbilled-cases")
def client_unbilled_cases(
    client_id: int,
    db: Session = Depends(get_db),
    user: LabUser = Depends(get_current_user),
):
    """The actual delivered orders making up a clinic's `unbilled` amount —
    so the lab can see what's about to go on the next monthly statement."""
    if not user.lab_id:
        raise HTTPException(status_code=400, detail="No lab associated")

    cases = db.query(Case).filter(
        Case.lab_id == user.lab_id,
        Case.client_id == client_id,
        Case.status == "delivered",
        Case.invoice_id.is_(None),
    ).order_by(Case.delivered_at.desc().nullslast()).all()

    return {
        "cases": [
            {
                "id": c.id,
                "case_number": c.case_number,
                "patient_name": c.patient_name,
                "doctor_name": c.doctor_name,
                "delivered_at": c.delivered_at,
                "total_amount": round(float(c.total_amount or 0), 2),
            }
            for c in cases
        ],
        "total": len(cases),
    }


# ── Helpers ─────────────────────────────────────────────────────────────

def _invoice_to_response(invoice: Invoice, client_name: str = None) -> dict:
    data = InvoiceResponse.model_validate(invoice).model_dump()
    data["client_name"] = client_name
    return data


def _payment_to_response(payment: Payment, client_name: str = None) -> dict:
    data = PaymentResponse.model_validate(payment).model_dump()
    data["client_name"] = client_name
    return data
