"""
How a password is turned into something safe to store, and how it is checked.

Until this module existed the answer was `sha256(password)`, written out four
separate times in four files. Two things were wrong with that.

It is unsalted, so identical passwords produce identical hashes: one glance at
the column tells you which accounts share a password, and a single precomputed
table cracks all of them at once. And it is fast, which is the opposite of what
is wanted here. A commodity GPU works through billions of SHA-256 guesses a
second, so the entire column is recoverable in the time it takes to notice it
has leaked. Nothing about a dentist's password is exotic enough to survive that.

## The scheme

bcrypt at cost 12, over a SHA-256 pre-hash of the password.

The pre-hash is not decoration. bcrypt takes at most 72 bytes and version 5
raises rather than silently truncating, so a long passphrase out of a password
manager would have turned into a 500 on the login route. Hashing first gives
bcrypt a fixed 44-byte input whatever the person typed, which is the same thing
Django's BCryptSHA256 hasher and passlib's bcrypt_sha256 do.

Stored hashes carry a `bcrypt_sha256$` marker so the format is greppable and
nobody later tries to verify one with a bare bcrypt call and concludes the
password is wrong.

## Migrating without a forced reset

Every old sha256 hash in the column stays valid. `verify_password` recognises
both formats, and the login path asks `needs_rehash` afterwards and quietly
re-stores the password under the new scheme. Somebody who signs in once is
migrated; somebody who never comes back keeps a weak hash, which is exactly the
row that matters least. Nobody is emailed, nobody is locked out, and there is no
migration window during which half the accounts do not work.

Once `needs_rehash` stops finding anything in production, the legacy branch here
can be deleted and any remaining rows are dormant accounts that should reset.
"""
import base64
import hashlib
import re
from typing import Optional

import bcrypt

# Cost 12 is roughly a quarter-second per verification on the kind of instance
# this runs on. That is unnoticeable on a login and ruinous for a guesser, which
# is the entire trade being made. Raise it when the hardware makes it cheap;
# existing hashes carry their own cost and keep verifying either way.
BCRYPT_ROUNDS = 12

PREFIX = "bcrypt_sha256$"

# What the old scheme looked like: a bare 64-character hex digest.
_LEGACY_SHA256 = re.compile(r"^[0-9a-f]{64}$")


def _prehash(plain: str) -> bytes:
    """SHA-256 then base64, so bcrypt always gets 44 bytes. See module docs."""
    return base64.b64encode(hashlib.sha256(plain.encode("utf-8")).digest())


def hash_password(plain: str) -> str:
    """The form a password is stored in. Always the current scheme."""
    hashed = bcrypt.hashpw(_prehash(plain), bcrypt.gensalt(rounds=BCRYPT_ROUNDS))
    return PREFIX + hashed.decode("ascii")


def is_legacy(stored: Optional[str]) -> bool:
    """True for a hash written by the old unsalted sha256 scheme."""
    return bool(stored) and bool(_LEGACY_SHA256.match(stored))


def verify_password(plain: Optional[str], stored: Optional[str]) -> bool:
    """Check a typed password against whatever is in the column.

    Accepts both schemes, so this can be deployed before a single row has been
    migrated. Returns False rather than raising on anything unrecognised: a
    corrupted or half-written hash should refuse the sign-in, not 500 it.
    """
    if not plain or not stored:
        return False

    if stored.startswith(PREFIX):
        try:
            return bcrypt.checkpw(_prehash(plain), stored[len(PREFIX):].encode("ascii"))
        except (ValueError, TypeError):
            return False

    if is_legacy(stored):
        # Constant-time even here. The comparison leaks nothing useful on its
        # own, but a hash comparison that short-circuits is the habit worth not
        # having anywhere near this file.
        import hmac
        return hmac.compare_digest(
            hashlib.sha256(plain.encode("utf-8")).hexdigest(), stored
        )

    return False


def needs_rehash(stored: Optional[str]) -> bool:
    """Should this hash be re-written now that we know the password?

    True for the old scheme, and for a bcrypt hash whose cost has fallen behind
    BCRYPT_ROUNDS. Call it only on the successful-login path, where the plain
    password is in hand and re-storing it costs nothing.
    """
    if not stored:
        return False
    if is_legacy(stored):
        return True
    if stored.startswith(PREFIX):
        try:
            # $2b$12$....  ->  the cost is the segment between the 2nd and 3rd $
            cost = int(stored[len(PREFIX):].split("$")[2])
            return cost < BCRYPT_ROUNDS
        except (IndexError, ValueError):
            return False
    # Something we do not recognise. Leave it alone; verify_password refuses it
    # anyway, so there is no password in hand to rewrite it with.
    return False
