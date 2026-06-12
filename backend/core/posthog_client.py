import os
from posthog import Posthog

# Initialize the Posthog client
# It relies on POSTHOG_API_KEY and POSTHOG_HOST environment variables.
# If not set, we configure it to be disabled so it doesn't crash the app.

POSTHOG_API_KEY = os.environ.get("POSTHOG_API_KEY")
POSTHOG_HOST = os.environ.get("POSTHOG_HOST", "https://app.posthog.com")

if POSTHOG_API_KEY:
    ph_client = Posthog(project_api_key=POSTHOG_API_KEY, host=POSTHOG_HOST)
else:
    # Create a dummy client or set it to disabled to prevent errors in development
    # Posthog SDK has a 'disabled' flag
    ph_client = Posthog(project_api_key="disabled", host=POSTHOG_HOST)
    ph_client.disabled = True

class EVENTS:
    """Catalog of backend event names — keep in sync with the frontend catalog
    (frontend/src/analytics/events.js)."""
    SIGNUP_COMPLETED = "signup_completed"
    ONBOARDING_COMPLETED = "onboarding_completed"
    PATIENT_CREATED = "patient_created"
    APPOINTMENT_BOOKED = "appointment_booked"
    INVOICE_FINALIZED = "invoice_finalized"
    WHATSAPP_MESSAGE_SENT = "whatsapp_message_sent"
    FREE_TRIAL_STARTED = "free_trial_started"
    SUBSCRIPTION_DOWNGRADED = "subscription_downgraded"
    TRIAL_ENDED = "trial_ended"


def track_event(user_id: str, event_name: str, properties: dict = None, clinic_id=None):
    """Safely track a backend event. Pass clinic_id to roll the event up under
    the 'clinic' group so it slices by clinic/plan in PostHog.

    NOTE: posthog-python 6+/7 uses capture(event, distinct_id=..., properties=...,
    groups=...) — event is the first positional arg, not distinct_id."""
    if ph_client and not ph_client.disabled:
        try:
            kwargs = {"distinct_id": user_id, "properties": properties or {}}
            if clinic_id is not None:
                kwargs["groups"] = {"clinic": str(clinic_id)}
            ph_client.capture(event_name, **kwargs)
        except Exception:
            # Prevent tracking errors from affecting main business logic
            pass


def capture_exception(error: Exception, user_id: str = "backend", properties: dict = None):
    """Safely report a backend exception to PostHog error tracking. Never raises."""
    if ph_client and not ph_client.disabled:
        try:
            if hasattr(ph_client, "capture_exception"):
                ph_client.capture_exception(error, distinct_id=user_id, properties=properties or {})
            else:
                # Fallback for older SDKs: emit a $exception event.
                ph_client.capture(user_id, "$exception", {
                    "$exception_message": str(error),
                    "$exception_type": type(error).__name__,
                    **(properties or {}),
                })
        except Exception:
            pass

def group_identify(group_type: str, group_key: str, properties: dict = None):
    """Safely update group properties."""
    if ph_client and not ph_client.disabled:
        try:
            ph_client.group_identify(group_type, group_key, properties)
        except Exception as e:
            pass

def identify_user(user_id: str, properties: dict = None):
    """Safely update user properties."""
    if ph_client and not ph_client.disabled:
        try:
            ph_client.identify(user_id, properties)
        except Exception as e:
            pass
