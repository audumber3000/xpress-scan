"""
The channel-agnostic inbox API.

Every route here takes a provider key and delegates. Nothing in this file knows
what BetterBox or WaSphere are, which is the whole point: the frontend asks for
"conversations on provider X" and the registry decides who answers.

Not mounted yet. It goes into main.py at the same time the first provider
actually returns data, so a half-built endpoint is never reachable in prod.
"""

# TODO(phase-1):
#   GET  /inbox/providers                     which are configured and connected
#   GET  /inbox/{provider}/conversations
#   GET  /inbox/{provider}/conversations/{id}
#   POST /inbox/{provider}/send
