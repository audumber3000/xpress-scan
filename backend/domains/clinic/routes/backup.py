"""Taking your data out.

A clinic's records are the clinic's. Until now the only way to get at them was
one screen at a time — a patient CSV here, a collections CSV there — and none of
that adds up to a copy of the practice. This does: every row this clinic owns,
one CSV per table, in a single zip.

Three rules shape it:

1. **Every column, not a chosen few.** A hand-written column list is a list that
   silently stops matching the table. The columns come off the model, so a
   column added next year is in the backup the day it exists.

2. **Nothing that is not theirs.** Every dataset carries its own filter down to
   `clinic_id`, and the two tables that have no such column are reached through
   the invoice that does. There is no "export everything and hope".

3. **Secrets do not travel.** Password hashes, tokens and signature images are
   excluded by name. A backup is meant to be emailed to an accountant and left
   on a laptop, and none of those should survive that.

Owner-only, and audited: a full copy of the practice leaving the building is
exactly the event a security log exists to record.
"""
import csv
import io
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session

from core.audit import CLINIC_EXPORTED, record_audit
from core.auth_utils import require_role
from database import get_db
from models import (
    Appointment, Attendance, CaseCost, CasePaper, DailyVisit, Expense,
    InventoryItem, Invoice, InvoiceLineItem, InvoicePayment, LabOrder,
    Medication, MedicationStock, Patient, PatientConsent, PatientDocument,
    Payment, Prescription, TreatmentType, User, Vendor,
)

router = APIRouter()

# A backup of the practice, not of the account. Data the clinic entered is in;
# our own plumbing (audit rows, notification logs, wallet ledgers, device
# records) is not — it is ours, it is large, and none of it is what somebody
# means when they ask for their records.
DATASETS = [
    # key, label, model, what it holds, and the group it is shown under.
    ("patients", "Patients", Patient, "Every patient record on file.", "Clinical"),
    ("case_papers", "Case papers", CasePaper, "Visit notes, charting and diagnoses.", "Clinical"),
    ("prescriptions", "Prescriptions", Prescription, "What was prescribed, and when.", "Clinical"),
    ("appointments", "Appointments", Appointment, "The whole calendar, past and future.", "Clinical"),
    ("daily_register", "Daily register", DailyVisit, "Who walked in on which day.", "Clinical"),
    ("lab_orders", "Lab orders", LabOrder, "Work sent out and what came back.", "Clinical"),
    ("consents", "Signed consents", PatientConsent, "Consent forms patients have signed.", "Clinical"),
    ("documents", "Document index", PatientDocument, "A list of files on patient records (not the files).", "Clinical"),

    ("invoices", "Invoices", Invoice, "Every bill raised.", "Money"),
    ("invoice_items", "Invoice lines", InvoiceLineItem, "What each bill was made of.", "Money"),
    ("invoice_payments", "Payments against bills", InvoicePayment, "Part-payments and settlements.", "Money"),
    ("payments", "Payments", Payment, "The payment ledger.", "Money"),
    ("expenses", "Expenses", Expense, "What the practice spent.", "Money"),
    ("case_costs", "Doctor fees", CaseCost, "What each case owed which clinician.", "Money"),

    ("treatments", "Treatments & pricing", TreatmentType, "Your procedure list and rates.", "Practice"),
    ("medications", "Medications", Medication, "Your medicine catalogue.", "Practice"),
    ("medication_stock", "Medication stock", MedicationStock, "Stock on hand.", "Practice"),
    ("inventory", "Inventory", InventoryItem, "Consumables and equipment.", "Practice"),
    ("vendors", "Vendors", Vendor, "Suppliers and labs you buy from.", "Practice"),
    ("staff", "Staff", User, "Your team, without their credentials.", "Practice"),
    ("attendance", "Attendance", Attendance, "Clock-ins and clock-outs.", "Practice"),
]

# Columns that must never leave, by table. Credentials first, then the two
# free-standing blobs: a signature image is a legal mark, and a base64 avatar
# would double the size of the file for nothing.
_EXCLUDED = {
    "users": {"password_hash", "supabase_user_id", "signature_url", "avatar_url",
              "permissions", "dashboard_preferences"},
    "patient_consents": {"signature_data", "signature_base64"},
    "patients": {"photo_url"},
}

_BY_KEY = {d[0]: d for d in DATASETS}


def _rows_for(db: Session, model, clinic_id: int):
    """This clinic's rows of one table, and only this clinic's.

    InvoiceLineItem is the one table here with no clinic_id of its own, so it is
    reached through the invoice that owns it rather than being exported wholesale
    and filtered afterwards — a filter applied after the fact is a filter that
    can be forgotten.
    """
    if model is InvoiceLineItem:
        return (db.query(InvoiceLineItem)
                  .join(Invoice, InvoiceLineItem.invoice_id == Invoice.id)
                  .filter(Invoice.clinic_id == clinic_id)
                  .order_by(InvoiceLineItem.id))
    return db.query(model).filter(model.clinic_id == clinic_id).order_by(model.id)


def _cell(value):
    """One value, written the way a spreadsheet will read it back.

    Datetimes go out in ISO 8601 rather than Python's repr, and JSON columns as
    their own text — a dict rendered with str() uses single quotes and is not
    JSON, which is a difference nobody notices until they try to read the file
    back in.
    """
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat(sep=" ", timespec="seconds")
    if isinstance(value, (dict, list)):
        import json
        return json.dumps(value, ensure_ascii=False, default=str)
    return value


def _csv_for(db: Session, model, clinic_id: int) -> str:
    """One table as CSV, every column the model declares."""
    table = model.__tablename__
    skip = _EXCLUDED.get(table, set())
    columns = [c.name for c in model.__table__.columns if c.name not in skip]

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(columns)
    for row in _rows_for(db, model, clinic_id):
        writer.writerow([_cell(getattr(row, c, None)) for c in columns])
    return buf.getvalue()


@router.get("/datasets", summary="What a backup would contain")
def list_datasets(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("clinic_owner")),
):
    """Each dataset with the number of rows sitting behind it.

    Counted rather than estimated, so somebody about to rely on a backup can see
    that their 4,000 patients are in it before they trust the file.
    """
    out = []
    for key, label, model, description, group in DATASETS:
        try:
            count = _rows_for(db, model, current_user.clinic_id).count()
        except Exception:  # noqa: BLE001 — one unreadable table must not hide the rest
            count = None
        out.append({
            "key": key, "label": label, "description": description,
            "group": group, "rows": count,
        })
    return {"datasets": out}


@router.get("/export", summary="Download a zip of the clinic's data")
def export_backup(
    request: Request,
    datasets: str = Query("", description="Comma-separated dataset keys; blank means all"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("clinic_owner")),
):
    """Everything asked for, as one zip of CSVs.

    Built in memory on purpose. This is a few megabytes for a clinic of any
    normal size, and a temp file is a temp file somebody has to remember to
    delete — on a box that has run out of disk before.
    """
    wanted = [k.strip() for k in datasets.split(",") if k.strip()] or list(_BY_KEY)
    unknown = [k for k in wanted if k not in _BY_KEY]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Don't know how to export: {', '.join(unknown)}",
        )

    taken_at = datetime.now(timezone.utc)
    buf = io.BytesIO()
    included = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        for key in wanted:
            _, label, model, _, _ = _BY_KEY[key]
            try:
                archive.writestr(f"{key}.csv", _csv_for(db, model, current_user.clinic_id))
                included.append(label)
            except Exception as e:  # noqa: BLE001
                # A table that will not read must not cost the clinic the other
                # twenty. The failure is written into the zip so the person
                # holding it knows what is missing rather than finding out later.
                archive.writestr(
                    f"{key}.FAILED.txt",
                    f"This table could not be exported on {taken_at.isoformat()}.\n"
                    f"Reason: {type(e).__name__}\n",
                )

        archive.writestr("README.txt", (
            "MolarPlus data export\n"
            f"Taken: {taken_at.isoformat(sep=' ', timespec='seconds')} UTC\n"
            f"Clinic: {current_user.clinic_id}\n"
            f"By: {getattr(current_user, 'name', '') or getattr(current_user, 'email', '')}\n\n"
            "One CSV per table. The first row of each is the column names.\n"
            "Times are UTC. Columns holding structured data are written as JSON.\n\n"
            "Not included: uploaded files themselves (x-rays, scans, signed PDFs),\n"
            "which are downloaded from the patient's file, and anything that would\n"
            "let somebody sign in as your team.\n\n"
            "Included in this file:\n" + "".join(f"  - {n}\n" for n in included)
        ))

    # A full copy of the practice leaving is worth a line in the security log,
    # whether or not anything went wrong afterwards.
    record_audit(
        db, current_user, CLINIC_EXPORTED,
        f"Downloaded a data backup ({len(included)} of {len(wanted)} datasets)",
        request=request, entity_type="clinic", entity_id=current_user.clinic_id,
        commit=True,
    )

    stamp = taken_at.strftime("%Y%m%d-%H%M")
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="molarplus-backup-{stamp}.zip"'},
    )
