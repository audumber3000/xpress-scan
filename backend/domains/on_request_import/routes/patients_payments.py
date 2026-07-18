"""
ON-REQUEST IMPORT — TEMPORARY / DISPOSABLE.

Purpose-built importer for one clinic's combined patient + payments spreadsheet
(Patient ID, Name, Village, Mobile, Doctor, Tooth, Procedure, Start Date, Total
Amount, Pay 1..10 Date/Amount, ...). It maps each row to:
  - a patient (matched by the sheet's Patient ID -> our display_id, else created)
  - one finalized invoice for the procedure (Total Amount as the line item)
  - one invoice_payment per non-empty Pay N

This whole domain is isolated so it can be deleted without touching core code.
The invoicing + partial-payment tracking it feeds (Invoice, InvoicePayment) is
the permanent product feature; this importer is the throwaway accommodation.
"""
from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import Invoice, InvoiceLineItem, InvoicePayment, Patient, User
# Reuse the core finance helpers so behaviour matches manual invoices exactly.
from domains.finance.routes.invoices import recalculate_invoice_totals, sync_invoice_from_payments

router = APIRouter(prefix="/on-request-import", tags=["on-request-import"])


class PaymentRow(BaseModel):
    date: Optional[str] = None    # YYYY-MM-DD
    amount: float


class ImportRow(BaseModel):
    patient_ref: Optional[str] = None   # sheet "Patient ID" -> our display_id
    name: str
    village: Optional[str] = None
    mobile: str
    doctor: Optional[str] = None
    tooth: Optional[str] = None
    procedure: Optional[str] = None
    start_date: Optional[str] = None
    total_amount: float = 0.0
    remarks: Optional[str] = None
    sheet_total_paid: Optional[float] = None  # for reconciliation only
    payments: List[PaymentRow] = []


class ImportPayload(BaseModel):
    rows: List[ImportRow]


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    s = str(s).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _next_invoice_number(db: Session, clinic_id: int, year: int, offset: int) -> str:
    last = (
        db.query(Invoice)
        .filter(Invoice.clinic_id == clinic_id, Invoice.invoice_number.like(f"INV-{year}-%"))
        .order_by(desc(Invoice.invoice_number))
        .first()
    )
    base = 0
    if last:
        try:
            base = int(last.invoice_number.split("-")[-1])
        except (ValueError, IndexError):
            base = 0
    return f"INV-{year}-{base + offset:04d}"


@router.post("/patients-payments")
def import_patients_payments(
    payload: ImportPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clinic_id = current_user.clinic_id
    invoices_created = patients_created = patients_matched = 0
    errors: List[dict] = []
    warnings: List[dict] = []
    year = datetime.utcnow().year
    number_offset = 1

    for idx, row in enumerate(payload.rows):
        row_num = idx + 1
        sp = db.begin_nested()  # savepoint: one bad row can't sink the batch
        try:
            name = (row.name or "").strip()
            mobile = (row.mobile or "").strip()
            if not name:
                raise ValueError("Name is required")
            if not mobile:
                raise ValueError("Mobile is required")

            # ── Patient: match by the sheet's Patient ID (our display_id), else phone.
            patient = None
            ref = (row.patient_ref or "").strip()
            if ref:
                patient = db.query(Patient).filter(
                    Patient.clinic_id == clinic_id, Patient.display_id == ref
                ).first()
            if not patient and mobile:
                patient = db.query(Patient).filter(
                    Patient.clinic_id == clinic_id, Patient.phone == mobile
                ).first()

            if patient:
                patients_matched += 1
            else:
                patient = Patient(
                    clinic_id=clinic_id,
                    name=name,
                    phone=mobile,
                    village=(row.village or "").strip() or None,
                    display_id=ref or None,
                    treatment_type=(row.procedure or "").strip() or "General Consultation",
                    referred_by=(row.doctor or "").strip() or None,
                )
                db.add(patient)
                db.flush()
                patients_created += 1

            # ── Invoice for the procedure.
            start = _parse_date(row.start_date)
            invoice = Invoice(
                clinic_id=clinic_id,
                patient_id=patient.id,
                invoice_number=_next_invoice_number(db, clinic_id, year, number_offset),
                status="draft",
                subtotal=0.0, tax=0.0, discount=0.0, total=0.0,
                paid_amount=0.0, due_amount=0.0,
                created_by=current_user.id,
                notes="; ".join(filter(None, [
                    f"Doctor: {row.doctor}" if row.doctor else None,
                    f"Tooth: {row.tooth}" if row.tooth else None,
                    row.remarks or None,
                ])) or None,
            )
            if start:
                invoice.created_at = datetime(start.year, start.month, start.day)
            db.add(invoice)
            db.flush()
            number_offset += 1

            desc_txt = (row.procedure or "Treatment").strip()
            if row.tooth:
                desc_txt = f"{desc_txt} (Tooth {row.tooth})"
            db.add(InvoiceLineItem(
                invoice_id=invoice.id, description=desc_txt,
                quantity=1.0, unit_price=float(row.total_amount or 0),
                amount=float(row.total_amount or 0),
            ))
            db.flush()
            recalculate_invoice_totals(db, invoice)
            invoice.status = "finalized"
            invoice.finalized_at = datetime.utcnow()

            # ── Payments (each non-empty Pay N).
            paid_sum = 0.0
            for p in row.payments:
                amt = float(p.amount or 0)
                if amt <= 0:
                    continue
                db.add(InvoicePayment(
                    invoice_id=invoice.id, clinic_id=clinic_id,
                    amount=amt, paid_on=_parse_date(p.date),
                    method="Cash", note="Imported",
                ))
                paid_sum += amt
            db.flush()
            sync_invoice_from_payments(invoice)

            # ── Reconcile against the sheet's own Total Paid, if given.
            if row.sheet_total_paid is not None and abs(paid_sum - float(row.sheet_total_paid)) > 0.5:
                warnings.append({
                    "row": row_num,
                    "message": f"Sheet Total Paid {row.sheet_total_paid} differs from summed payments {paid_sum}; used {paid_sum}",
                })

            sp.commit()
            invoices_created += 1
        except Exception as e:  # noqa: BLE001 — report the row, keep importing
            sp.rollback()
            errors.append({"row": row_num, "message": str(e)})

    db.commit()
    return {
        "invoices_created": invoices_created,
        "patients_created": patients_created,
        "patients_matched": patients_matched,
        "errors": errors,
        "warnings": warnings,
    }
