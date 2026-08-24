"""
BetterBox as an InboxProvider.

Thin on purpose: it wires oauth + client + mapper together and implements the
protocol. Anything with real logic belongs in one of those three.
"""

from typing import List, Optional

from ..base import Channel, ConnectionState, Conversation, InboxProvider, Message


class BetterBoxProvider(InboxProvider):
    channel = Channel.EMAIL
    key = "betterbox"

    async def state(self, clinic_id: int) -> ConnectionState:
        raise NotImplementedError("phase-1")

    async def conversations(self, clinic_id: int, *, limit: int = 50,
                            cursor: Optional[str] = None) -> List[Conversation]:
        raise NotImplementedError("phase-1")

    async def messages(self, clinic_id: int, conversation_id: str,
                       *, limit: int = 50) -> List[Message]:
        raise NotImplementedError("phase-1")

    async def send(self, clinic_id: int, *, to: str, body: str,
                   conversation_id: Optional[str] = None,
                   subject: Optional[str] = None) -> Message:
        raise NotImplementedError("phase-1")
