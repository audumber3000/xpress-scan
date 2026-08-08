"""Recording consequential actions.

One helper, called from the handful of places that delete things, move money, or
change who can do what. Deliberately not a blanket middleware: a log with every
GET in it is a log nobody reads, and the row you actually need — who deleted
that patient last Tuesday — is the one that gets buried.

The write is best-effort. An audit row failing must never be the reason a
clinic can't finish an operation; a missing log line is recoverable, a
half-completed delete is not.
"""
import logging

logger = logging.getLogger(__name__)

# Action names are `entity.verb`, so the UI can group them and a filter on
# "patient." catches everything about patients without a hardcoded list.
PATIENT_DELETED      = 'patient.deleted'
PATIENT_UPDATED      = 'patient.updated'
INVOICE_DELETED      = 'invoice.deleted'
PAYMENT_DELETED      = 'payment.deleted'
PAYMENT_ADDED        = 'payment.added'
DISCOUNT_ADDED       = 'discount.added'
DISCOUNT_REMOVED     = 'discount.removed'
STAFF_CREATED        = 'staff.created'
STAFF_UPDATED        = 'staff.updated'
STAFF_DEACTIVATED    = 'staff.deactivated'
PERMISSIONS_CHANGED  = 'permissions.changed'
CLINIC_UPDATED       = 'clinic.updated'
TEMPLATE_UPDATED     = 'template.updated'
DEVICE_BLOCKED       = 'device.blocked'
DEVICE_REMOVED       = 'device.removed'
SECURITY_UPDATED     = 'security.updated'

# Shown in the UI's filter dropdown, in the order they appear there.
ACTION_LABELS = {
    PATIENT_DELETED:     'Patient deleted',
    PATIENT_UPDATED:     'Patient edited',
    INVOICE_DELETED:     'Invoice deleted',
    PAYMENT_DELETED:     'Payment removed',
    PAYMENT_ADDED:       'Payment recorded',
    DISCOUNT_ADDED:      'Discount granted',
    DISCOUNT_REMOVED:    'Discount reversed',
    STAFF_CREATED:       'Staff added',
    STAFF_UPDATED:       'Staff edited',
    STAFF_DEACTIVATED:   'Staff deactivated',
    PERMISSIONS_CHANGED: 'Permissions changed',
    CLINIC_UPDATED:      'Clinic settings changed',
    TEMPLATE_UPDATED:    'Document template changed',
    DEVICE_BLOCKED:      'Device blocked',
    DEVICE_REMOVED:      'Device removed',
    SECURITY_UPDATED:    'Recovery contact changed',
}


def _client_ip(request) -> str:
    """The caller's address, honouring the proxy header the app sits behind.

    X-Forwarded-For is a comma-separated chain; the first entry is the original
    client. Falls back to the socket address when there's no proxy.
    """
    if request is None:
        return ''
    forwarded = request.headers.get('x-forwarded-for') or ''
    if forwarded:
        return forwarded.split(',')[0].strip()
    real = request.headers.get('x-real-ip')
    if real:
        return real.strip()
    return getattr(getattr(request, 'client', None), 'host', '') or ''


def record_audit(
    db, current_user, action: str, summary: str, *,
    request=None, entity_type: str = None, entity_id: int = None,
):
    """Append one audit row. Flushes but does not commit — the caller's own
    transaction decides whether the action and its log entry both stick."""
    try:
        from models import AuditLog

        db.add(AuditLog(
            clinic_id=getattr(current_user, 'clinic_id', None),
            user_id=getattr(current_user, 'id', None),
            actor_name=getattr(current_user, 'name', None),
            actor_role=getattr(current_user, 'role', None),
            action=action,
            summary=summary[:500],
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=_client_ip(request)[:64] or None,
            user_agent=(request.headers.get('user-agent') if request else None or '')[:300] or None,
        ))
        db.flush()
    except Exception as exc:
        # Never let bookkeeping break the operation being booked.
        logger.warning(f"audit write failed for {action}: {exc}")
