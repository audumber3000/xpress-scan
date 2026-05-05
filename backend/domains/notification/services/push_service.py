"""
Push Notification Service — sends Expo push notifications to clinic devices.

Uses Expo's push API (https://exp.host/--/api/v2/push/send) which works for
both iOS and Android without needing separate FCM/APNs configuration.
"""
import requests
from typing import List, Optional
from sqlalchemy.orm import Session
from models import PushToken


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class PushService:
    """Send push notifications to all devices registered for a clinic."""

    def send_to_clinic(
        self,
        db: Session,
        clinic_id: int,
        title: str,
        body: str,
        data: Optional[dict] = None,
    ) -> dict:
        """Send a notification to ALL active tokens for a given clinic."""
        tokens = (
            db.query(PushToken.token)
            .filter(PushToken.clinic_id == clinic_id, PushToken.is_active == True)
            .all()
        )
        token_list = [t[0] for t in tokens]
        if not token_list:
            return {"sent": 0, "errors": [], "message": "No registered devices"}

        return self._send_batch(token_list, title, body, data)

    def send_to_user(
        self,
        db: Session,
        user_id: int,
        title: str,
        body: str,
        data: Optional[dict] = None,
    ) -> dict:
        """Send a notification to all devices of a specific user."""
        tokens = (
            db.query(PushToken.token)
            .filter(PushToken.user_id == user_id, PushToken.is_active == True)
            .all()
        )
        token_list = [t[0] for t in tokens]
        if not token_list:
            return {"sent": 0, "errors": [], "message": "No registered devices for user"}

        return self._send_batch(token_list, title, body, data)

    def _send_batch(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[dict] = None,
    ) -> dict:
        """Send push messages via Expo Push API."""
        messages = [
            {
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data or {},
            }
            for token in tokens
        ]

        # Expo accepts batches up to 100
        errors = []
        sent = 0
        for i in range(0, len(messages), 100):
            batch = messages[i : i + 100]
            try:
                resp = requests.post(
                    EXPO_PUSH_URL,
                    json=batch,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                result = resp.json()
                tickets = result.get("data", [])
                for ticket in tickets:
                    if ticket.get("status") == "ok":
                        sent += 1
                    else:
                        errors.append(ticket.get("message", "Unknown error"))
            except Exception as e:
                errors.append(str(e))

        return {"sent": sent, "total": len(tokens), "errors": errors}


push_service = PushService()
