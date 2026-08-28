"""
What stands between a password guesser and the sign-in endpoint.

Until this module existed: nothing. There was no rate limit, no lockout and no
backoff on any login route, so the only thing bounding how many passwords could
be tried against a clinic owner's account was how fast the attacker's script
could open connections.

## Two limits, two different jobs

**Per account.** Five wrong passwords inside fifteen minutes and that identifier
goes cold for a while, doubling each time it happens again, capped at thirty
minutes. This is the one that protects one dentist from someone working through
a wordlist against their address.

**Per IP.** Fifty failures inside fifteen minutes from one address and that
address goes cold, whatever accounts it was aiming at. This is the one that
catches spraying: one guess each against a thousand accounts never trips a
per-account limit, because no single account has seen more than one failure.

The per-account key is the string that was typed, lower-cased. Deliberately not
"the account, if it exists": throttling only real accounts would make a 429 a
reliable signal that an address is registered, and this endpoint is careful
everywhere else not to answer that question.

## Where the state lives

In this process, in a dict. That is an honest fit for how the backend actually
runs today: one uvicorn worker, no `--workers` flag, one container. If that ever
changes to multiple workers or a second instance, the limit multiplies by the
number of processes and this needs to move behind Redis, which the stack already
runs for the job queue.

Deliberately NOT in Redis today. A login path that depends on Redis being up is
a login path that fails closed the first time Redis restarts, and locking every
clinic out of the product to slow down a hypothetical guesser is a bad trade.
This design degrades to "no throttle" on a process restart, which is the right
direction to fail in.

## It always says when

Every refusal carries the number of seconds left, in the body and in the
`Retry-After` headers, because the clients render a live countdown from it. A
limit somebody can watch tick down reads as a wait. A bare "too many attempts"
reads as being locked out for good, and the customer's response to that is to
stop trying to use the product.
"""
import threading
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

# --- per account (the identifier that was typed) ---
ACCOUNT_FREE_ATTEMPTS = 5
ACCOUNT_WINDOW_SEC = 15 * 60
# How long the account stays cold, by how many times it has already been locked
# in this window. Starts short on purpose: the overwhelming majority of people
# tripping this are the rightful owner misremembering their own password, and a
# minute is a pause while half an hour is a support call.
ACCOUNT_LOCK_STEPS_SEC = (60, 5 * 60, 15 * 60, 30 * 60)

# --- per client address ---
IP_FREE_ATTEMPTS = 50
IP_WINDOW_SEC = 15 * 60
IP_LOCK_SEC = 15 * 60

# Stops a flood of distinct keys turning this into a memory leak. Well above any
# real clinic's traffic; when it trips, the coldest half is dropped, which at
# worst forgives some attempts.
MAX_TRACKED_KEYS = 20_000


@dataclass
class _Bucket:
    failures: List[float] = field(default_factory=list)
    locked_until: float = 0.0
    lock_count: int = 0
    last_seen: float = 0.0


class LoginThrottle:
    def __init__(self) -> None:
        self._buckets: Dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    # -- internals -------------------------------------------------------

    def _bucket(self, key: str, now: float) -> _Bucket:
        b = self._buckets.get(key)
        if b is None:
            b = _Bucket()
            self._buckets[key] = b
        b.last_seen = now
        return b

    def _prune(self, now: float) -> None:
        if len(self._buckets) <= MAX_TRACKED_KEYS:
            return
        # Drop the half nobody has touched recently. Cheap, and the worst case
        # is that a long-dormant attacker gets their allowance back.
        ordered = sorted(self._buckets.items(), key=lambda kv: kv[1].last_seen)
        for key, _ in ordered[: len(ordered) // 2]:
            self._buckets.pop(key, None)

    @staticmethod
    def _account_key(identifier: str) -> str:
        return "a:" + (identifier or "").strip().lower()

    @staticmethod
    def _ip_key(ip: str) -> str:
        return "i:" + (ip or "unknown")

    def _retry_after(self, key: str, now: float) -> int:
        b = self._buckets.get(key)
        if not b or b.locked_until <= now:
            return 0
        return max(1, int(round(b.locked_until - now)))

    # -- the API the routes use -----------------------------------------

    def check(self, identifier: str, ip: str) -> Optional[Tuple[int, str]]:
        """Is this attempt allowed? Returns None, or (seconds, reason).

        Called BEFORE the password is checked, so a locked account costs a dict
        lookup rather than a bcrypt verification. That matters: bcrypt is
        deliberately slow, and letting an attacker spend our CPU at will is its
        own denial of service.
        """
        now = time.monotonic()
        with self._lock:
            wait = self._retry_after(self._account_key(identifier), now)
            if wait:
                return wait, "account"
            wait = self._retry_after(self._ip_key(ip), now)
            if wait:
                return wait, "ip"
        return None

    def record_failure(self, identifier: str, ip: str) -> None:
        """A wrong password. Counts against both buckets, may start a lockout."""
        now = time.monotonic()
        with self._lock:
            self._prune(now)
            self._count(self._account_key(identifier), now,
                        ACCOUNT_WINDOW_SEC, ACCOUNT_FREE_ATTEMPTS, None)
            self._count(self._ip_key(ip), now,
                        IP_WINDOW_SEC, IP_FREE_ATTEMPTS, IP_LOCK_SEC)

    def _count(self, key: str, now: float, window: int, allowance: int,
               fixed_lock: Optional[int]) -> None:
        b = self._bucket(key, now)
        cutoff = now - window
        b.failures = [t for t in b.failures if t > cutoff]
        b.failures.append(now)
        if len(b.failures) >= allowance:
            if fixed_lock is not None:
                lock_for = fixed_lock
            else:
                step = min(b.lock_count, len(ACCOUNT_LOCK_STEPS_SEC) - 1)
                lock_for = ACCOUNT_LOCK_STEPS_SEC[step]
            b.lock_count += 1
            b.locked_until = now + lock_for
            # The window starts again from the lockout, so serving the wait does
            # not immediately re-trip on the same stale failures.
            b.failures = []

    def record_success(self, identifier: str, ip: str) -> None:
        """A correct password wipes the account's record.

        The IP bucket is deliberately left alone. Somebody guessing their way
        through a list of accounts will eventually get one right, and that
        should not hand them a clean slate for the rest of the list.
        """
        with self._lock:
            self._buckets.pop(self._account_key(identifier), None)

    def reset(self) -> None:
        """Tests only."""
        with self._lock:
            self._buckets.clear()


throttle = LoginThrottle()


def client_ip(request) -> str:
    """The caller's address, trusting the proxy header the load balancer sets.

    Takes the FIRST entry of X-Forwarded-For, which is the client as recorded by
    the edge. Anything further right in that list is a proxy hop, and anything
    the client itself put there is already sitting to the left of what our own
    infrastructure appended.
    """
    forwarded = request.headers.get("x-forwarded-for") if request else None
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return getattr(getattr(request, "client", None), "host", None) or "unknown"


def lockout_message(seconds: int, reason: str) -> str:
    """What the person reads. Says how long, and what to do with the wait."""
    if seconds >= 90:
        wait = f"{round(seconds / 60)} minutes"
    else:
        wait = f"{seconds} seconds"
    if reason == "ip":
        return f"Too many sign-in attempts from this network. Please wait {wait} and try again."
    # Says the wait and the reason, and stops there. Offering "or reset your
    # password" here too would duplicate the link the web screen puts directly
    # underneath this sentence, and the mobile screen has its own Forgot
    # password control in view. The message states the situation; each client
    # owns the way out of it.
    return f"Too many sign-in attempts for this account. Please wait {wait} and try again."
