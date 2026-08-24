"""
Which providers this build knows about.

The only module allowed to import a vendor package. Phase 1 registers BetterBox
alone; WaSphere is present but not registered, so nothing can reach a
half-finished WhatsApp path by accident.
"""

from typing import Dict

from .base import Channel, InboxProvider
from .betterbox.provider import BetterBoxProvider

_PROVIDERS: Dict[str, InboxProvider] = {
    BetterBoxProvider.key: BetterBoxProvider(),
    # Phase 2. Left commented rather than absent so the shape is obvious:
    # WaSphereProvider.key: WaSphereProvider(),
}


def get(key: str) -> InboxProvider:
    if key not in _PROVIDERS:
        raise KeyError(f"Unknown inbox provider: {key}")
    return _PROVIDERS[key]


def for_channel(channel: Channel):
    return [p for p in _PROVIDERS.values() if p.channel == channel]


def enabled_keys():
    return list(_PROVIDERS)
