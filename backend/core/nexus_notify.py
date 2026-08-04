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
                log_id: int = None, provider: str = None,
                wareach_session_id: str = None, wareach_api_key: str = None):
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
        # WA Reach (own-number WhatsApp) — only added when explicitly routing via it.
        if provider == "wareach":
            payload["provider"] = "wareach"
            payload["wareach_session_id"] = wareach_session_id
            payload["wareach_api_key"] = wareach_api_key
        if log_id:
            payload["log_id"] = log_id
            payload["callback_url"] = f"{MAIN_BACKEND_URL}/api/v1/notification-admin/logs/{log_id}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(f"{NEXUS_BASE}/api/v1/notifications/send-event", json=payload)
    except Exception as e:
        logger.warning(f"nexus_notify [{event_type}] silently failed: {e}")


# Strong references to in-flight fire-and-forget tasks. asyncio only keeps a
# WEAK reference to tasks created via create_task, so without this a task can be
# garbage-collected mid-await — before `_fire`'s `async with httpx.AsyncClient()`
# exits — leaking the socket to Nexus. Accumulating those leaked descriptors is
# what exhausted the process file-descriptor limit ("Too many open files").
_inflight_tasks: set = set()


def notify(event_type: str, channel: str = "email", to_email: str = "", to_name: str = "",
           to_phone: str = "", template_data: dict = None, attachments=None, log_id: int = None,
           provider: str = None, wareach_session_id: str = None, wareach_api_key: str = None):
    """
    Schedule a fire-and-forget Nexus notification from any sync or async context.
    Safe to call from within FastAPI route handlers — never raises.
    """
    coro = _fire(event_type, channel, to_email, to_name, to_phone,
                 template_data or {}, attachments, log_id, provider,
                 wareach_session_id, wareach_api_key)
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop is not None:
            # Async context (FastAPI handler / async scheduled job): schedule on
            # the running loop, but hold a strong reference until it completes so
            # the task can't be GC'd before its httpx client closes.
            task = loop.create_task(coro)
            _inflight_tasks.add(task)
            task.add_done_callback(_inflight_tasks.discard)
        else:
            # Sync context (worker thread / no running loop): run to completion in
            # a fresh loop that asyncio.run() creates AND closes, so neither the
            # loop's descriptors nor the httpx socket leak.
            asyncio.run(coro)
    except Exception as e:
        coro.close()  # never leave the coroutine un-awaited if scheduling failed
        logger.warning(f"nexus_notify schedule failed [{event_type}]: {e}")
