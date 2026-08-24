"""
Linking a clinic's Google account, and keeping it linked.

Separate from the client because the two fail differently: a dead refresh token
is a "reconnect your mailbox" the receptionist can act on, while a failed
message fetch is a retry. Collapsing them would show the wrong one.
"""

# TODO(phase-1): authorisation URL, code exchange, refresh, and revoke.
