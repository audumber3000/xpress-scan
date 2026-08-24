"""
Gmail's shapes, turned into the inbox's shapes.

The one place that knows a Gmail thread is a Conversation and a Gmail header is
a Participant. Everything above the provider package sees only base.py types,
which is what lets WhatsApp arrive later without the UI learning a second
vocabulary.
"""

# TODO(phase-1): thread -> Conversation, message -> Message, header -> Participant.
