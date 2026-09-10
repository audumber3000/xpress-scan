"""Marking an appointment completed from evidence that the patient was seen.

Nothing in this application ever wrote `completed`. The value was read in two
places — appointment_stats.py and kpi_detail.py — and written by exactly one
route, POST /appointments/{id}/outcome, which somebody has to remember to call.
In practice nobody did: appointments sat in `arrived` forever, so the no-show
rate and the utilisation figures were computed against a denominator that never
resolved.

─── Evidence, not inference ──────────────────────────────────────────────────

appointments.py's /needs-outcome endpoint argues, correctly, that outcomes are
"deliberately surfaced rather than auto-marked", because "guessing a no-show on
a clinic's behalf would poison the very number this whole change exists to
earn".

This does not contradict that, and the distinction is the whole design:

  * A case paper written against an appointment is POSITIVE EVIDENCE. A
    clinician sat down and recorded clinical findings for that visit. The
    patient was there. Concluding `completed` is reading a fact off the record.
  * Absence of a record is NOT evidence of absence. The patient may have been
    seen by somebody who writes nothing up. Concluding `no_show` from silence
    would be a guess, and it is the guess that poisons the number.

So this module only ever moves an appointment TO `completed`, only ever on
positive evidence, and never marks anything as missed. Everything else keeps
going through /needs-outcome, where a human answers.
"""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from domains.scheduling.appointment_status import COMPLETED, OPEN_STATUSES, normalize_status

logger = logging.getLogger(__name__)

# Where the conclusion came from, stored on the row so an audit can tell an
# inference from somebody's decision.
SOURCE_CASE_PAPER = "case_paper"
SOURCE_INVOICE = "invoice"


def complete_appointment_if_open(db: Session, appointment, user, source: str) -> bool:
    """Mark `appointment` completed, if it is still open. Returns whether it moved.

    Only from OPEN_STATUSES. An appointment the clinic explicitly marked
    `cancelled` or `no_show` is never overridden: they told us what happened,
    and a later invoice against the same patient does not get to argue. That
    also makes the function safe to call more than once — a second case paper on
    the same appointment is a no-op rather than a second stamp.

    Does not commit. The caller owns the transaction, so this can sit inside the
    same unit of work as the case paper it was concluded from.
    """
    if appointment is None:
        return False

    if normalize_status(appointment.status) not in OPEN_STATUSES:
        return False

    appointment.status = COMPLETED
    appointment.outcome_at = datetime.utcnow()
    # The person who wrote the evidence is who evidenced it. Not a system user:
    # a real name here is what makes the audit trail answerable later.
    appointment.outcome_by = getattr(user, "id", None)
    if hasattr(appointment, "outcome_source"):
        appointment.outcome_source = source
    return True


def appointment_for_invoice(db: Session, invoice):
    """The appointment an invoice belongs to, or None.

    ⚠️ Invoice carries BOTH `appointment_id` and `case_paper_id`, and older
    case-paper invoices OVERLOAD `appointment_id` to hold a case paper id. Read
    naively, that would complete an unrelated appointment that happens to share
    the number.

    So: trust `case_paper_id` first and take the appointment from the paper, and
    only fall back to `appointment_id`. Either way the result is patient-guarded
    before it is returned — an appointment belonging to a different patient is
    the clearest possible sign the id meant something else.
    """
    from models import Appointment, CasePaper

    appointment = None

    case_paper_id = getattr(invoice, "case_paper_id", None)
    if case_paper_id:
        paper = db.query(CasePaper).filter(CasePaper.id == case_paper_id).first()
        if paper and paper.appointment_id:
            appointment = db.query(Appointment).filter(
                Appointment.id == paper.appointment_id
            ).first()

    if appointment is None and getattr(invoice, "appointment_id", None):
        appointment = db.query(Appointment).filter(
            Appointment.id == invoice.appointment_id
        ).first()

    if appointment is None:
        return None

    # The guard that makes the overloaded id safe.
    if appointment.patient_id != invoice.patient_id:
        logger.info(
            "invoice %s points at appointment %s belonging to another patient; ignoring",
            getattr(invoice, "id", "?"), appointment.id,
        )
        return None
    if appointment.clinic_id != invoice.clinic_id:
        return None

    return appointment
