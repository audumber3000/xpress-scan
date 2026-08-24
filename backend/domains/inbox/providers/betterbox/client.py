"""
The HTTP calls to the Gmail API, and nothing else.

No domain types in here. This layer speaks Gmail's own vocabulary (threads,
messages, labels, historyId) and hands raw payloads to mapper.py. Keeping the
translation out of it means a Gmail API change touches one file.
"""

# TODO(phase-1): threads.list, threads.get, messages.send, and the history sync.
