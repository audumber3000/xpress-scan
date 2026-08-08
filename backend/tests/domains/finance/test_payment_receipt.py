"""Per-installment payment receipts: numbering, frozen figures, and the render.

Two things are being protected here.

The numbering/snapshot tests protect the promise that makes rendering-on-demand
safe: a receipt's number and its two running figures are stamped once, when the
money is taken, and never move afterwards. If those drift, a patient holding a
printed slip and a clinic reprinting the same receipt see different documents.

The golden test locks the rendered HTML so any change to the receipt's wording
or layout shows up as a reviewable diff, matching how the invoice variants are
guarded.
"""
from __future__ import annotations

import datetime
import os

import pytest
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from domains.finance.receipt_pdf_engine import generate_receipt_html
from tests.domains.finance.test_invoice_pdf_golden import _sample_clinic, _sample_invoice

GOLDEN_DIR = Path(__file__).resolve().parents[2] / "golden"


# ── Fixtures ─────────────────────────────────────────────────────────────────

def _sample_payment():
    """An installment mid-way through a bill: some paid, some still owed."""
    return SimpleNamespace(
        id=7,
        amount=2500.00,
        paid_on=datetime.date(2026, 4, 27),
        method="UPI",
        note="Second installment",
        created_at=datetime.datetime(2026, 4, 27, 11, 30, 0),
        receipt_number="RCP-2026-0031",
        receipt_paid_to_date=4000.00,
        receipt_balance_due=2490.00,
    )


def _fresh_db():
    """Self-contained sqlite session — these tests are about arithmetic and
    sequencing, not about the prod schema, so they don't need the postgres
    fixtures in conftest."""
    from models import Base

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _seed(db, total=18000.0):
    from models import Clinic, Invoice, Patient

    db.add_all([
        Clinic(id=1, name="Smile Dental", clinic_code="SM1"),
        Clinic(id=2, name="Other Dental", clinic_code="OT1"),
        Patient(id=1, clinic_id=1, name="Asha Mehta", phone="9876543210",
                treatment_type="General"),
    ])
    invoice = Invoice(
        id=1, clinic_id=1, patient_id=1, invoice_number="INV-2026-0001",
        status="finalized", subtotal=total, total=total,
        paid_amount=0.0, due_amount=total,
    )
    db.add(invoice)
    db.commit()
    return invoice


def _record(db, invoice, amount, paid_on, clinic_id=1):
    """Mirror what the payments route does: add the row, resync the invoice,
    then stamp the receipt — all in one transaction."""
    from models import InvoicePayment
    from domains.finance.routes.invoices import assign_receipt_details, sync_invoice_from_payments

    payment = InvoicePayment(
        invoice_id=invoice.id, clinic_id=clinic_id, amount=amount,
        paid_on=paid_on, method="Cash", created_at=datetime.datetime.utcnow(),
    )
    db.add(payment)
    db.flush()
    sync_invoice_from_payments(invoice)
    assign_receipt_details(db, invoice, payment)
    db.commit()
    return payment


# ── Numbering and frozen figures ─────────────────────────────────────────────

def test_receipts_number_in_sequence_and_carry_running_totals():
    db = _fresh_db()
    invoice = _seed(db)

    first = _record(db, invoice, 6000.0, datetime.date(2026, 8, 1))
    second = _record(db, invoice, 5000.0, datetime.date(2026, 8, 7))

    assert first.receipt_number == "RCP-2026-0001"
    assert (first.receipt_paid_to_date, first.receipt_balance_due) == (6000.0, 12000.0)

    assert second.receipt_number == "RCP-2026-0002"
    assert (second.receipt_paid_to_date, second.receipt_balance_due) == (11000.0, 7000.0)


def test_back_dated_entry_does_not_rewrite_earlier_receipts():
    """Cash taken on Saturday and entered on Monday receipts under the year it
    was received — but the receipts already issued keep their figures. Anything
    else would mean a patient's slip stops matching the clinic's copy."""
    db = _fresh_db()
    invoice = _seed(db)

    first = _record(db, invoice, 6000.0, datetime.date(2026, 8, 1))
    second = _record(db, invoice, 5000.0, datetime.date(2026, 8, 7))
    late = _record(db, invoice, 1000.0, datetime.date(2025, 12, 20))

    db.refresh(first)
    db.refresh(second)

    assert late.receipt_number == "RCP-2025-0001", "should number under the year received"
    assert (first.receipt_paid_to_date, second.receipt_paid_to_date) == (6000.0, 11000.0)
    assert (late.receipt_paid_to_date, late.receipt_balance_due) == (12000.0, 6000.0)


def test_receipt_sequence_is_per_clinic():
    db = _fresh_db()
    invoice = _seed(db)
    _record(db, invoice, 6000.0, datetime.date(2026, 8, 1))

    from models import Invoice
    other = Invoice(
        id=2, clinic_id=2, patient_id=1, invoice_number="INV-2026-0001",
        status="finalized", subtotal=500.0, total=500.0,
        paid_amount=0.0, due_amount=500.0,
    )
    db.add(other)
    db.commit()

    theirs = _record(db, other, 500.0, datetime.date(2026, 8, 7), clinic_id=2)
    assert theirs.receipt_number == "RCP-2026-0001", "clinics must not share a sequence"
    assert theirs.receipt_balance_due == 0.0


def test_restamping_never_changes_an_issued_receipt():
    from domains.finance.routes.invoices import assign_receipt_details

    db = _fresh_db()
    invoice = _seed(db)
    payment = _record(db, invoice, 6000.0, datetime.date(2026, 8, 1))
    before = (payment.receipt_number, payment.receipt_paid_to_date, payment.receipt_balance_due)

    assign_receipt_details(db, invoice, payment)

    assert (payment.receipt_number, payment.receipt_paid_to_date, payment.receipt_balance_due) == before


def test_deleting_a_payment_stops_later_receipts_counting_it():
    """A deletion says the money was never received. Unlike a post-issue
    discount, that has to flow back through the receipts that counted it —
    otherwise a later slip quotes a total that never existed. Numbers stand."""
    from domains.finance.routes.invoices import resync_receipt_running_totals, sync_invoice_from_payments

    db = _fresh_db()
    invoice = _seed(db)
    first = _record(db, invoice, 6000.0, datetime.date(2026, 8, 1))
    mistake = _record(db, invoice, 5000.0, datetime.date(2026, 8, 3))
    third = _record(db, invoice, 2000.0, datetime.date(2026, 8, 7))
    assert third.receipt_paid_to_date == 13000.0

    third_number = third.receipt_number
    db.delete(mistake)
    db.flush()
    sync_invoice_from_payments(invoice)
    resync_receipt_running_totals(invoice)
    db.commit()

    db.refresh(first)
    db.refresh(third)
    assert (first.receipt_paid_to_date, first.receipt_balance_due) == (6000.0, 12000.0)
    assert (third.receipt_paid_to_date, third.receipt_balance_due) == (8000.0, 10000.0)
    assert third.receipt_number == third_number, "an issued number must not be reused or moved"


def test_sequence_keeps_ordering_past_the_ninth_receipt():
    """The next number comes from a string sort, so the zero-padding has to hold
    once the count goes double-digit."""
    db = _fresh_db()
    invoice = _seed(db, total=100.0)

    last = None
    for _ in range(11):
        last = _record(db, invoice, 1.0, datetime.date(2026, 8, 7))

    assert last.receipt_number == "RCP-2026-0011"


# ── Rendering ────────────────────────────────────────────────────────────────

def _cfg(template_id, **kw):
    return SimpleNamespace(
        template_id=template_id,
        primary_color=kw.get("primary_color", "#FF9800"),
        footer_text=kw.get("footer_text", ""),
        logo_url=kw.get("logo_url", None),
    )


ALL_VARIANTS = ["classic", "modern"]


@pytest.mark.parametrize("variant", ALL_VARIANTS)
def test_receipt_shows_this_payment_paid_so_far_and_balance(variant):
    """Whatever the design, the three figures a part-payer needs are on it."""
    rendered = generate_receipt_html(
        _sample_invoice(), _sample_payment(), _sample_clinic(), _cfg(variant)
    )

    assert "RCP-2026-0031" in rendered
    assert "2,500.00" in rendered      # this payment
    assert "4,000.00" in rendered      # paid so far, including this one
    assert "2,490.00" in rendered      # still due
    assert "INV-101" in rendered       # the bill it belongs to
    # The balance is a snapshot, and the document has to say so — a later
    # concession moves the invoice, not this slip.
    assert "as on" in rendered
    # Amount-in-words describes the payment, never the running total.
    assert "Two Thousand Five Hundred Rupees Only" in rendered


@pytest.mark.parametrize("variant", ALL_VARIANTS)
def test_fully_settling_payment_says_so(variant):
    payment = _sample_payment()
    payment.receipt_paid_to_date = 6490.00
    payment.receipt_balance_due = 0.0

    rendered = generate_receipt_html(
        _sample_invoice(), payment, _sample_clinic(), _cfg(variant)
    )

    assert "settled in full" in rendered


@pytest.mark.parametrize("variant", ALL_VARIANTS)
def test_payment_from_before_receipts_existed_still_renders(variant):
    """Rows whose snapshot columns were never backfilled must not blow up: fall
    back to live figures rather than showing a blank receipt."""
    legacy = SimpleNamespace(
        id=3, amount=1000.00, paid_on=None, method=None, note=None,
        created_at=datetime.datetime(2026, 2, 14, 10, 0, 0),
        receipt_number=None, receipt_paid_to_date=None, receipt_balance_due=None,
    )

    rendered = generate_receipt_html(
        _sample_invoice(), legacy, _sample_clinic(), _cfg(variant)
    )

    assert "1,000.00" in rendered
    assert "5,490.00" in rendered   # invoice total less this payment
    assert "2026" in rendered       # dated from created_at when paid_on is blank
    assert "Cash" in rendered       # method falls back rather than rendering 'None'


@pytest.mark.parametrize("variant", ALL_VARIANTS)
def test_receipt_drops_rupee_wording_outside_india(variant):
    clinic = _sample_clinic()
    clinic.country = "AE"
    clinic.currency_symbol = "AED"
    clinic.tax_label = "TRN"

    rendered = generate_receipt_html(
        _sample_invoice(), _sample_payment(), clinic, _cfg(variant)
    )

    assert "Rupees" not in rendered
    assert "AED 2,500.00" in rendered
    assert "TRN: " in rendered


@pytest.mark.parametrize("variant", ALL_VARIANTS)
def test_receipt_renders_with_malicious_inputs_safely(variant):
    """Same guard as the invoice templates: poisoned data must not become
    executable HTML/CSS or an outbound fetch."""
    poisoned = _cfg(
        variant,
        primary_color="red; } body { display:none; /*",
        footer_text="<script>alert(1)</script>",
        logo_url="http://169.254.169.254/latest/meta-data/",
    )
    payment = _sample_payment()
    payment.note = "<img src=x onerror=alert(1)>"

    rendered = generate_receipt_html(_sample_invoice(), payment, _sample_clinic(), poisoned)

    assert "<script>" not in rendered
    assert "display:none" not in rendered
    assert "169.254.169.254" not in rendered
    assert "&lt;script&gt;" in rendered
    # The note is escaped to inert text, not stripped — the words survive, the
    # tag does not.
    assert "<img src=x" not in rendered
    assert "&lt;img src=x onerror=alert(1)&gt;" in rendered


# ── Matching the invoice the patient is holding ──────────────────────────────

def test_receipt_follows_the_clinics_invoice_template():
    """The whole point of the registry: a clinic on Classic invoices must not be
    handed a Modern-looking receipt. These two designs have to stay distinct and
    each has to be reachable from its own template_id."""
    inv, pay, clinic = _sample_invoice(), _sample_payment(), _sample_clinic()

    classic_html = generate_receipt_html(inv, pay, clinic, _cfg("classic"))
    modern_html = generate_receipt_html(inv, pay, clinic, _cfg("modern"))

    assert classic_html != modern_html, "the two variants must actually differ"

    # Classic's signatures, shared with the Classic invoice.
    assert "color-strip" in classic_html
    assert "PAYMENT RECEIPT" in classic_html and "receipt-title" in classic_html
    assert "Terms &amp; Conditions" in classic_html
    assert "Authorized Signatory / Seal" in classic_html
    assert "grand-total" in classic_html

    # Modern's signatures — none of the above.
    assert "color-strip" not in modern_html
    assert "Authorised Signatory" in modern_html
    assert "Authorized Signatory / Seal" not in modern_html


def test_legacy_and_unknown_template_ids_fall_back_to_classic():
    """Old DB rows carry ids like 'modern_orange' / 'standard'. They alias the
    same way the invoice registry aliases them, so the pair stays consistent
    rather than the bill going Classic and the receipt going Modern."""
    inv, pay, clinic = _sample_invoice(), _sample_payment(), _sample_clinic()
    expected = generate_receipt_html(inv, pay, clinic, _cfg("classic"))

    for legacy_id in ("modern_orange", "classic_blue", "standard", "default", "", None):
        got = generate_receipt_html(inv, pay, clinic, _cfg(legacy_id))
        assert got == expected, f"{legacy_id!r} should render as classic"

    # A config row that predates template_id entirely, and no config at all.
    assert generate_receipt_html(inv, pay, clinic, None) == expected


def test_every_invoice_variant_has_a_receipt_counterpart():
    """A clinic can only pick from the invoice registry, so every id there must
    resolve to a receipt of the same name — otherwise someone silently gets a
    mismatched pair via the fallback."""
    from domains.finance.invoice_templates import INVOICE_VARIANTS
    from domains.finance.receipt_templates import RECEIPT_VARIANTS

    assert set(INVOICE_VARIANTS) == set(RECEIPT_VARIANTS)


# ── Goldens ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("variant", ALL_VARIANTS)
def test_receipt_html_matches_golden(variant):
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    golden_path = GOLDEN_DIR / f"payment_receipt_{variant}.html"
    config = _cfg(variant, footer_text="This is a computer-generated receipt. No signature required.")
    rendered = generate_receipt_html(_sample_invoice(), _sample_payment(), _sample_clinic(), config)

    if os.environ.get("UPDATE_GOLDEN") == "1" or not golden_path.exists():
        golden_path.write_text(rendered, encoding="utf-8")
        if not os.environ.get("UPDATE_GOLDEN"):
            pytest.skip(f"Wrote new golden at {golden_path}. Re-run to verify.")
        return

    expected = golden_path.read_text(encoding="utf-8")
    assert rendered == expected, (
        f"{variant} receipt HTML diverged from golden at {golden_path}.\n"
        f"If the change is intentional, re-run with UPDATE_GOLDEN=1 to refresh."
    )
