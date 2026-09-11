"""Which appointment and which case paper a record actually belongs to.

Two ids can arrive and both can be wrong. Older clients, the mobile app among
them, put a CASE PAPER id in `appointment_id`: case papers used to be reached
through the appointment slot, and the phone never learned the difference. The
routes then checked that an appointment with that id existed in the clinic and,
when none did, silently dropped the link. So a prescription or invoice written
from a phone's case paper arrived attached to nothing, and when an appointment
with the same number happened to exist it arrived attached to a stranger's.

This resolves both ids in one place, and patient-guards them: a link is kept
only when it points at this patient's own appointment or case paper.
"""
from models import Appointment, CasePaper


def resolve_visit_links(db, clinic_id, patient_id, appointment_id=None, case_paper_id=None):
    """Return the (appointment_id, case_paper_id) a new record should carry.

    * `appointment_id` is kept when it is one of this patient's appointments.
    * Otherwise, if no case paper was named and the id is one of this patient's
      case papers, it is read as the case paper it was meant to be.
    * `case_paper_id` is kept when it is one of this patient's case papers.
    * Anything else becomes None: an unlinked record, never a wrong one.
    """
    appt = None
    if appointment_id is not None:
        if db.query(Appointment.id).filter(
            Appointment.id == appointment_id,
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id == patient_id,
        ).first():
            appt = appointment_id
        elif case_paper_id is None:
            case_paper_id = appointment_id

    paper = None
    if case_paper_id is not None:
        if db.query(CasePaper.id).filter(
            CasePaper.id == case_paper_id,
            CasePaper.clinic_id == clinic_id,
            CasePaper.patient_id == patient_id,
        ).first():
            paper = case_paper_id

    return appt, paper
