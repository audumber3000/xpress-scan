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
MASTER_PASSWORD_SET  = 'security.master_password'

# Authentication. None of this was recorded, which for a clinical system is the
# largest gap of all: an audit log that cannot answer "who signed in, from
# where" or "was anyone trying passwords against this account" is not a
# security log. Failed attempts matter as much as successful ones.
LOGIN_SUCCEEDED      = 'auth.login'
LOGIN_FAILED         = 'auth.login_failed'
LOGIN_BLOCKED        = 'auth.login_blocked'
LOGOUT               = 'auth.logout'
PASSWORD_CHANGED     = 'auth.password_changed'

# Shown in the UI's filter dropdown, in the order they appear there.
ACTION_LABELS = {
    LOGIN_SUCCEEDED:     'Signed in',
    LOGIN_FAILED:        'Failed sign-in',
    LOGIN_BLOCKED:       'Sign-in blocked',
    LOGOUT:              'Signed out',
    PASSWORD_CHANGED:    'Password changed',
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
    MASTER_PASSWORD_SET: 'Master password changed',
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


def _user_agent(request) -> str | None:
    """The client's User-Agent, or None.

    Written out because the inline version was
    `(request.headers.get('user-agent') if request else None or '')[:300]`,
    which Python reads as `A if request else ('')`. With a request present but
    no User-Agent header, A is None and None[:300] raises TypeError. The
    except below then swallowed it and the ENTIRE audit row was silently
    dropped, so any client that sends no User-Agent (the mobile app, an
    integration, a script) left no trace at all.
    """
    if request is None:
        return None
    ua = request.headers.get('user-agent')
    return ua[:300] if ua else None


def record_audit(
    db, current_user, action: str, summary: str, *,
    request=None, entity_type: str = None, entity_id: int = None,
    clinic_id: int = None, actor_name: str = None, commit: bool = False,
):
    """Append one audit row.

    Flushes but does not commit by default, so the caller's own transaction
    decides whether the action and its log entry both stick.

    `commit=True` is for events with no surrounding transaction to ride on: a
    failed sign-in writes nothing else, so without committing here the row is
    discarded when the request ends and the very attempt worth recording is
    the one that vanishes.

    `clinic_id` and `actor_name` are overrides for the same case: a failed
    login has no authenticated user to read them from, and "someone tried to
    sign in as X" is exactly what needs recording.
    """
    try:
        from models import AuditLog

        # SAVEPOINT, so a rejected audit row rolls back only itself. A bare
        # flush() that fails leaves the whole session in PendingRollbackError,
        # and then the next query the caller makes raises instead — which is
        # how an already-successful Google sign-in came back to the user as a
        # 500. Catching the error below is not enough on its own; the session
        # has to be repaired, and rolling back to a savepoint repairs it
        # without discarding work the caller has not committed yet.
        with db.begin_nested():
            db.add(AuditLog(
                clinic_id=clinic_id if clinic_id is not None else getattr(current_user, 'clinic_id', None),
                user_id=getattr(current_user, 'id', None),
                actor_name=actor_name or getattr(current_user, 'name', None),
                actor_role=getattr(current_user, 'role', None),
                action=action,
                summary=summary[:500],
                entity_type=entity_type,
                entity_id=entity_id,
                ip_address=_client_ip(request)[:64] or None,
                user_agent=_user_agent(request),
            ))
        if commit:
            db.commit()
    except Exception as exc:
        # Never let bookkeeping break the operation being booked. Logged at
        # error, not warning: a missing audit row is a compliance gap, not
        # noise, and it should be visible in Sentry rather than buried.
        logger.error("audit write failed for %s: %s", action, exc, exc_info=True)
