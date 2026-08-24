"""
Inbox rules that are ours rather than a vendor's.

Chiefly: tying a conversation to a patient. Neither BetterBox nor WaSphere knows
what a patient is, so matching an address or a phone to a record, and deciding
what to do when two patients share a number, happens here and only here.
"""

# TODO(phase-1): resolve_participants(), link_conversation_to_patient().
