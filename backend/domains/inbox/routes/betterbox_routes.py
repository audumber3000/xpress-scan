"""
The parts of BetterBox that are not channel-agnostic.

Connecting a mailbox is an email-shaped problem (an OAuth round trip with a
redirect), and pairing WhatsApp is a QR-shaped one. Neither fits the shared
interface, so each provider keeps its own connection routes and the shared API
stays honest.
"""

# TODO(phase-1): GET /inbox/betterbox/auth-url, GET /inbox/betterbox/callback,
#                POST /inbox/betterbox/disconnect
