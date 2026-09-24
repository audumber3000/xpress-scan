"""Whose signature goes on a bill.

Every invoice and receipt template used to look for it on the appointment and
nowhere else. A bill raised from a case paper, or with no visit at all, has no
appointment, so a doctor who had uploaded a signature still printed an empty
line. Five receipt styles read it off the payment row, which has no such
column, so they never printed one. One lookup here, used by all of them.
"""
from types import SimpleNamespace

from sqlalchemy.orm import object_session

from domains.infrastructure.services.pdf_safety import safe_signature_data_uri, safe_text


def _treating_doctor(invoice):
    """The doctor who actually saw the patient: the visit's, then the case
    paper's. None when the bill carries no clinical link."""
    appt = getattr(invoice, 'appointment', None)
    doc = (getattr(appt, 'doctor', None) or getattr(appt, 'dentist', None)) if appt else None
    if doc:
        return doc
    session = object_session(invoice)
    paper_id = getattr(invoice, 'case_paper_id', None)
    if session is None or not paper_id:
        return None
    from models import Appointment, CasePaper, User
    paper = session.query(CasePaper).filter(
        CasePaper.id == paper_id, CasePaper.clinic_id == invoice.clinic_id,
    ).first()
    if not paper:
        return None
    doctor_id = paper.dentist_id
    if not doctor_id and paper.appointment_id:
        appt = session.query(Appointment).filter(Appointment.id == paper.appointment_id).first()
        doctor_id = getattr(appt, 'doctor_id', None)
    if not doctor_id:
        return None
    return session.query(User).filter(
        User.id == doctor_id, User.clinic_id == invoice.clinic_id,
    ).first()


def _clinic_owner(invoice):
    session = object_session(invoice)
    if session is None or not getattr(invoice, 'clinic_id', None):
        return None
    from models import User
    return session.query(User).filter(
        User.clinic_id == invoice.clinic_id, User.role == 'clinic_owner',
    ).order_by(User.id).first()


def signing_doctor(invoice) -> SimpleNamespace:
    """`doctor` is the treating doctor (None if the bill has no visit), whose
    name and letters the bill should print. `signature` is theirs, or, for a
    bill with no visit, the clinic owner's: that bill already prints the
    clinic's own doctor name, which is the owner. Never fails: a broken
    relationship costs the bill its signature, not the bill."""
    doctor, signature = None, ''
    try:
        doctor = _treating_doctor(invoice)
        if doctor is not None:
            signature = safe_signature_data_uri(getattr(doctor, 'signature_url', None))
        else:
            owner = _clinic_owner(invoice)
            signature = safe_signature_data_uri(getattr(owner, 'signature_url', None))
    except Exception:
        pass
    return SimpleNamespace(
        doctor=doctor,
        signature=signature,
        name=safe_text(getattr(doctor, 'name', '') or '') if doctor else '',
        qualifications=safe_text(getattr(doctor, 'qualifications', '') or '') if doctor else '',
    )
