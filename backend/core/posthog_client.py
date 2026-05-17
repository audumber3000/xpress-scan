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

def track_event(user_id: str, event_name: str, properties: dict = None):
    """Safely track a backend event."""
    if ph_client and not ph_client.disabled:
        try:
            ph_client.capture(user_id, event_name, properties)
        except Exception as e:
            # Prevent tracking errors from affecting main business logic
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
