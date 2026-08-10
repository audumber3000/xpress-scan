"""
ON-REQUEST IMPORT — TEMPORARY / DISPOSABLE.

Purpose-built importer for one clinic's invoice ledger export:

    Invoice #, Patient, Total, Discount, Tax, Net Amount, Paid, Status, Date

Each row becomes one finalized invoice on our own numbering, with a single line
item at Total, the sheet's Discount applied, and (when money was collected) one
InvoicePayment for the paid amount.

Deliberate decisions, all of which came from looking at the actual sheet:

  * Their `Invoice #` is NOT used as our invoice number. We mint our own on the
    clinic's sequence and keep theirs in `notes` as `[imported:<ref>]`, which is
    also what makes a re-run idempotent: a row whose ref is already present is
    skipped rather than duplicated.

  * Patients are NEVER matched against existing records. The sheet has no phone
    number, and name-only matching against a live database silently merges two
    different people who happen to share a name. Rows *within one file* that
    share a normalised name still collapse to one patient, so three KIRITI S
    rows produce one patient with three invoices, not three patients.

  * Dates are DD/MM/YYYY. `10/08/2026` is 10 August. Parsed the other way it
    would silently become 8 October, and three of the first five rows flip, so
    the format is pinned rather than guessed.

  * Payments are written as Cash. The sheet records no method, and the Payments
    dashboard splits cash against digital on this field; leaving it null would
    file the whole ledger under digital.

  * Patients get the placeholder phone 0000000000, because `Patient.phone` is
    required and the sheet has none. See PLACEHOLDER_PHONE for why that is not
    the same as harmless.

This whole domain is isolated so it can be deleted without touching core code.
The invoicing and partial-payment tracking it feeds (Invoice, InvoicePayment)
is the permanent product feature; this importer is the throwaway accommodation.
"""
import re
from datetime import datetime, date
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import Integer, cast, desc, func
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import Invoice, InvoiceLineItem, InvoicePayment, Patient, User
# Reuse the core finance helpers so behaviour matches manual invoices exactly.
from domains.finance.routes.invoices import recalculate_invoice_totals, sync_invoice_from_payments

router = APIRouter(prefix="/on-request-import", tags=["on-request-import"])


class InvoiceRow(BaseModel):
    invoice_ref: Optional[str] = None   # their "Invoice #", kept for dedupe only
    patient_name: str
    total: float = 0.0
    discount: float = 0.0
    tax: float = 0.0
    net_amount: Optional[float] = None  # for reconciliation only
    paid: float = 0.0
    status: Optional[str] = None        # their word; we derive ours from the money
    date: Optional[str] = None          # DD/MM/YYYY


class ImportPayload(BaseModel):
    rows: List[InvoiceRow]


# Markers the clinic appends to a name that are not part of the name.
_NAME_MARKERS = re.compile(r"\((camp|fd)\)", re.IGNORECASE)

# Stand-in for the phone the sheet does not carry. `Patient.phone` is required,
# and an empty string reads as "someone forgot" while ten zeros reads as "we
# never had one", which is the truth and is greppable when staff come to fill
# them in: SELECT * FROM patients WHERE phone = '0000000000'.
#
# NOTE it is not inert. core/phone.normalize_phone() strips the leading "00" as
# an international prefix and hands "00000000" to the messaging provider, so a
# reminder or campaign aimed at these patients will still attempt a send and
# fail at MSG91 rather than being skipped here. Replace the numbers before
# running anything that messages them.
PLACEHOLDER_PHONE = "0000000000"


def normalise_name(raw: str) -> str:
    """Key used to collapse rows in one file onto a single patient.

    The sheet is hand-typed: `ishika  sai. P`, `M Nageshwar   RAO`, `KIRITI S`,
    `harsha  kumar(camp)`. Case, runs of whitespace, punctuation and the
    bracketed markers all vary between rows for what is plainly one person.
    """
    s = _NAME_MARKERS.sub(" ", raw or "")
    s = re.sub(r"[^A-Za-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def clean_display_name(raw: str) -> str:
    """The name we actually store: markers dropped, spacing tidied, case kept."""
    s = _NAME_MARKERS.sub(" ", raw or "")
    return re.sub(r"\s+", " ", s).strip()


def extract_markers(raw: str) -> List[str]:
    """`(camp)` and friends, preserved as invoice notes rather than discarded."""
    return [m.group(1).lower() for m in _NAME_MARKERS.finditer(raw or "")]


def parse_sheet_date(s: Optional[str]) -> Optional[date]:
    """DD/MM/YYYY, pinned. See the module docstring on why this is not guessed."""
    if not s:
        return None
    s = str(s).strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _next_display_id(db: Session, clinic_id: int) -> str:
    """Next 6-digit patient display_id (MAX numeric + 1, from 100001).

    Mirrors the core single-add path so imported patients share the clinic's own
    sequence. Called after each flush so patients created earlier in the same
    batch are counted.
    """
    max_id = (
        db.query(func.max(cast(Patient.display_id, Integer)))
        .filter(
            Patient.clinic_id == clinic_id,
            Patient.display_id.isnot(None),
            Patient.display_id.op("~")(r"^[0-9]+$"),
        )
        .scalar()
        or 100000
    )
    return str(max_id + 1)


def _invoice_number_base(db: Session, clinic_id: int, year: int) -> int:
    """Highest invoice sequence already used this year.

    Read ONCE before the batch, not per row. The importer this replaces
    recomputed the base inside the loop and then added a running offset to it,
    so each insert pushed the base up and the offsets compounded: twenty rows
    produced INV-2026-0001, 0003, 0006, 0010 … 0210, burning 210 numbers out of
    the clinic's sequence to create 20 invoices.
    """
    last = (
        db.query(Invoice)
        .filter(Invoice.clinic_id == clinic_id, Invoice.invoice_number.like(f"INV-{year}-%"))
        .order_by(desc(Invoice.invoice_number))
        .first()
    )
    if not last:
        return 0
    try:
        return int(last.invoice_number.split("-")[-1])
    except (ValueError, IndexError):
        return 0


def _already_imported_refs(db: Session, clinic_id: int) -> set:
    """Their invoice refs we have already taken, so a re-run is a no-op."""
    rows = (
        db.query(Invoice.notes)
        .filter(Invoice.clinic_id == clinic_id, Invoice.notes.like("%[imported:%"))
        .all()
    )
    found = set()
    for (note,) in rows:
        found.update(re.findall(r"\[imported:([^\]]+)\]", note or ""))
    return found


@router.post("/invoice-sheet")
def import_invoice_sheet(
    payload: ImportPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clinic_id = current_user.clinic_id
    year = datetime.utcnow().year

    seen_refs = _already_imported_refs(db, clinic_id)
    # normalised name -> Patient, so rows in this file sharing a name land on one
    # patient. Never seeded from the database: see the module docstring.
    patients_in_batch: Dict[str, Patient] = {}

    invoices_created = patients_created = skipped = 0
    errors: List[dict] = []
    warnings: List[dict] = []
    created_patients: List[dict] = []
    number_base = _invoice_number_base(db, clinic_id, year)
    number_offset = 1

    for idx, row in enumerate(payload.rows):
        row_num = idx + 1
        sp = db.begin_nested()  # savepoint: one bad row cannot sink the batch
        try:
            raw_name = (row.patient_name or "").strip()
            if not raw_name:
                raise ValueError("Patient name is required")

            ref = (row.invoice_ref or "").strip()
            if ref and ref in seen_refs:
                sp.rollback()
                skipped += 1
                warnings.append({"row": row_num, "message": f"{ref} was already imported, skipped"})
                continue

            key = normalise_name(raw_name)
            patient = patients_in_batch.get(key)
            if patient is None:
                patient = Patient(
                    clinic_id=clinic_id,
                    name=clean_display_name(raw_name),
                    phone=PLACEHOLDER_PHONE,
                    display_id=_next_display_id(db, clinic_id),
                    treatment_type="General Consultation",
                    payment_type="Cash",
                )
                db.add(patient)
                db.flush()
                patients_in_batch[key] = patient
                patients_created += 1
                created_patients.append({"name": patient.name, "display_id": patient.display_id})

            total = float(row.total or 0)
            discount = float(row.discount or 0)
            paid = float(row.paid or 0)
            when = parse_sheet_date(row.date)

            markers = extract_markers(raw_name)
            note_bits = [f"[imported:{ref}]" if ref else None]
            note_bits += [f"({m})" for m in markers]
            invoice = Invoice(
                clinic_id=clinic_id,
                patient_id=patient.id,
                invoice_number=f"INV-{year}-{number_base + number_offset:04d}",
                status="draft",
                subtotal=0.0, tax=0.0, discount=discount, discount_type="amount",
                total=0.0, paid_amount=0.0, due_amount=0.0,
                created_by=current_user.id,
                notes=" ".join(b for b in note_bits if b) or None,
            )
            if when:
                # Backdated so ageing and the revenue charts place these where
                # they actually happened, not on the day of the import.
                invoice.created_at = datetime(when.year, when.month, when.day)
            db.add(invoice)
            db.flush()
            number_offset += 1

            # The sheet has no procedure column, so one line carries the total.
            # An invoice with no line items renders as an empty bill in the
            # editor and the PDF, which is worse than a generic description.
            db.add(InvoiceLineItem(
                invoice_id=invoice.id,
                description="Treatment (imported)",
                quantity=1.0, unit_price=total, amount=total,
            ))
            db.flush()
            recalculate_invoice_totals(db, invoice)

            invoice.status = "finalized"
            invoice.finalized_at = invoice.created_at or datetime.utcnow()

            if paid > 0:
                db.add(InvoicePayment(
                    invoice_id=invoice.id, clinic_id=clinic_id,
                    amount=paid, paid_on=when,
                    method="Cash", note="Imported from sheet",
                ))
            db.flush()
            sync_invoice_from_payments(invoice)

            # Reconcile our computed total against the sheet's own Net Amount.
            if row.net_amount is not None and abs(float(invoice.total) - float(row.net_amount)) > 0.5:
                warnings.append({
                    "row": row_num,
                    "message": (
                        f"Sheet Net {row.net_amount} differs from computed "
                        f"{invoice.total} (Total {total} less discount {discount})"
                    ),
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
        "skipped": skipped,
        "created_patients": created_patients,
        "errors": errors,
        "warnings": warnings,
    }
