"""
Lightweight fire-and-forget helper to call the Nexus /send-event endpoint.
All calls are async and errors are swallowed so they never break the main request.
"""

import os
import asyncio
import logging
import httpx

logger = logging.getLogger(__name__)

NEXUS_BASE = os.getenv("NEXUS_SERVICES_URL", "http://localhost:8001")
MAIN_BACKEND_URL = os.getenv("MAIN_BACKEND_URL", "http://localhost:8000")


async def _fire(event_type: str, channel: str, to_email: str = "", to_name: str = "",
                to_phone: str = "", template_data: dict = None, attachments=None,
                log_id: int = None):
    try:
        payload = {
            "event_type": event_type,
            "channel": channel,
            "to_email": to_email,
            "to_name": to_name,
            "to_phone": to_phone,
            "template_data": template_data or {},
        }
        if attachments:
            payload["attachments"] = attachments
        if log_id:
            payload["log_id"] = log_id
            payload["callback_url"] = f"{MAIN_BACKEND_URL}/api/v1/notification-admin/logs/{log_id}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(f"{NEXUS_BASE}/api/v1/notifications/send-event", json=payload)
    except Exception as e:
        logger.warning(f"nexus_notify [{event_type}] silently failed: {e}")


def notify(event_type: str, channel: str = "email", to_email: str = "", to_name: str = "",
           to_phone: str = "", template_data: dict = None, attachments=None, log_id: int = None):
    """
    Schedule a fire-and-forget Nexus notification from any sync or async context.
    Safe to call from within FastAPI route handlers — never raises.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_fire(event_type, channel, to_email, to_name,
                                   to_phone, template_data or {}, attachments, log_id))
        else:
            loop.run_until_complete(_fire(event_type, channel, to_email, to_name,
                                          to_phone, template_data or {}, attachments, log_id))
    except Exception as e:
        logger.warning(f"nexus_notify schedule failed [{event_type}]: {e}")
