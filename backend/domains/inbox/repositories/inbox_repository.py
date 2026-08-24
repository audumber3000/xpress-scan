"""
Persistence for connections and the conversation index.

Message bodies are NOT stored. The provider is the source of truth and a clinic's
mail living in two places is a liability nobody asked for; this keeps only what
is needed to list threads quickly and to remember which patient a thread belongs
to.
"""

# TODO(phase-1): InboxConnection (clinic, provider, state, credentials),
#                ConversationLink (provider conversation id -> patient_id).
