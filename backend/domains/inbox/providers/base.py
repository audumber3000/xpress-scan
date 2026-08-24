"""
What every inbox provider has to be able to do.

Deliberately small. Email and WhatsApp are different enough that a fat shared
interface would end up half-implemented on both sides, so this is only the part
the UI genuinely treats identically: list conversations, read one, send a reply,
and report whether the account is connected.

Anything a single channel needs and the other cannot honour (a WhatsApp QR
pairing, an email label) belongs on that provider, reached through its own
routes, not bolted on here.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List, Optional


class Channel(str, Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"


class ConnectionState(str, Enum):
    DISCONNECTED = "disconnected"   # never linked, or explicitly unlinked
    PENDING = "pending"             # OAuth in flight, or QR shown and unscanned
    CONNECTED = "connected"
    ERROR = "error"                 # token expired, session killed from the phone


@dataclass
class Participant:
    """Whoever is on the other end. `patient_id` is filled by the domain, not by
    the provider: matching a phone or an address to a patient is our business
    and neither vendor knows anything about it."""
    display_name: str
    address: str                    # email address, or phone in E.164
    patient_id: Optional[int] = None


@dataclass
class Message:
    provider_id: str                # the vendor's own id, for dedupe on sync
    conversation_id: str
    sent_at: datetime
    body: str
    outbound: bool
    attachments: List[str]


@dataclass
class Conversation:
    provider_id: str
    channel: Channel
    subject: Optional[str]          # email has one, WhatsApp does not
    participants: List[Participant]
    last_message_at: datetime
    unread: int


class InboxProvider(ABC):
    """One connected account on one channel."""

    channel: Channel
    key: str                        # 'betterbox', 'wasphere'

    @abstractmethod
    async def state(self, clinic_id: int) -> ConnectionState: ...

    @abstractmethod
    async def conversations(self, clinic_id: int, *, limit: int = 50,
                            cursor: Optional[str] = None) -> List[Conversation]: ...

    @abstractmethod
    async def messages(self, clinic_id: int, conversation_id: str,
                       *, limit: int = 50) -> List[Message]: ...

    @abstractmethod
    async def send(self, clinic_id: int, *, to: str, body: str,
                   conversation_id: Optional[str] = None,
                   subject: Optional[str] = None) -> Message: ...
