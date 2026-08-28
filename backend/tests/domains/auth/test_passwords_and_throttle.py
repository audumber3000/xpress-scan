"""
The password scheme and the login throttle.

Both exist to make a specific attack expensive, so the tests are mostly about
the awkward cases rather than the happy path: old hashes still working, long
passwords not raising, a lockout that ends.
"""
import hashlib
import time

import pytest

from core import passwords
from core.login_throttle import (
    ACCOUNT_FREE_ATTEMPTS,
    IP_FREE_ATTEMPTS,
    LoginThrottle,
    lockout_message,
)


class TestHashing:
    def test_a_password_verifies_against_its_own_hash(self):
        h = passwords.hash_password("open sesame")
        assert passwords.verify_password("open sesame", h)

    def test_the_wrong_password_does_not(self):
        h = passwords.hash_password("open sesame")
        assert not passwords.verify_password("open sesamf", h)

    def test_the_same_password_hashes_differently_every_time(self):
        """The whole point of a salt. Two clinics sharing a password must not
        share a hash, or one glance at the column groups them."""
        a = passwords.hash_password("same password")
        b = passwords.hash_password("same password")
        assert a != b
        assert passwords.verify_password("same password", a)
        assert passwords.verify_password("same password", b)

    def test_a_very_long_password_works(self):
        """bcrypt takes 72 bytes and version 5 RAISES past that rather than
        truncating, so without the sha256 pre-hash a password manager's
        passphrase would have turned the login route into a 500."""
        long_one = "correct horse battery staple " * 20
        assert len(long_one.encode()) > 72
        assert passwords.verify_password(long_one, passwords.hash_password(long_one))

    def test_two_long_passwords_sharing_a_prefix_are_distinguished(self):
        a = "x" * 100 + "one"
        b = "x" * 100 + "two"
        assert not passwords.verify_password(b, passwords.hash_password(a))

    def test_unicode_survives(self):
        pw = "सूर्य नमस्कार 🦷"
        assert passwords.verify_password(pw, passwords.hash_password(pw))


class TestLegacyHashes:
    """Nobody is emailed and nobody is locked out. Old rows keep working."""

    def _legacy(self, plain):
        return hashlib.sha256(plain.encode()).hexdigest()

    def test_an_old_sha256_hash_still_signs_somebody_in(self):
        assert passwords.verify_password("hunter2", self._legacy("hunter2"))

    def test_an_old_hash_still_rejects_the_wrong_password(self):
        assert not passwords.verify_password("hunter3", self._legacy("hunter2"))

    def test_an_old_hash_is_flagged_for_upgrade(self):
        assert passwords.needs_rehash(self._legacy("hunter2"))

    def test_a_current_hash_is_not(self):
        assert not passwords.needs_rehash(passwords.hash_password("hunter2"))

    def test_upgrading_preserves_the_password(self):
        """What the login path does: verify against the old hash, then re-store."""
        old = self._legacy("hunter2")
        assert passwords.verify_password("hunter2", old)
        new = passwords.hash_password("hunter2")
        assert passwords.verify_password("hunter2", new)
        assert not passwords.verify_password("wrong", new)


class TestRefusesRatherThanRaises:
    """A half-written or corrupt hash should refuse the sign-in, not 500 it."""

    @pytest.mark.parametrize("stored", [None, "", "not-a-hash", "$2b$12$tooshort", "z" * 64])
    def test_garbage_is_just_false(self, stored):
        assert passwords.verify_password("anything", stored) is False

    @pytest.mark.parametrize("plain", [None, ""])
    def test_no_password_is_just_false(self, plain):
        assert passwords.verify_password(plain, passwords.hash_password("x")) is False

    def test_needs_rehash_is_quiet_about_nonsense(self):
        assert passwords.needs_rehash(None) is False
        assert passwords.needs_rehash("not-a-hash") is False


class TestThrottle:
    @pytest.fixture()
    def t(self):
        return LoginThrottle()

    def test_the_allowance_is_not_spent_early(self, t):
        for _ in range(ACCOUNT_FREE_ATTEMPTS - 1):
            t.record_failure("dr@x.com", "1.1.1.1")
        assert t.check("dr@x.com", "1.1.1.1") is None

    def test_it_locks_once_the_allowance_is_gone(self, t):
        for _ in range(ACCOUNT_FREE_ATTEMPTS):
            t.record_failure("dr@x.com", "1.1.1.1")
        cooling = t.check("dr@x.com", "1.1.1.1")
        assert cooling is not None
        seconds, reason = cooling
        assert reason == "account" and seconds > 0

    def test_the_lock_follows_the_address_not_its_capitals(self, t):
        """Otherwise the throttle is bypassed by holding down shift."""
        for _ in range(ACCOUNT_FREE_ATTEMPTS):
            t.record_failure("dr@x.com", "1.1.1.1")
        assert t.check("DR@X.COM", "9.9.9.9") is not None

    def test_one_locked_account_does_not_lock_the_clinic(self, t):
        for _ in range(ACCOUNT_FREE_ATTEMPTS):
            t.record_failure("dr@x.com", "1.1.1.1")
        assert t.check("reception@x.com", "1.1.1.1") is None

    def test_signing_in_clears_the_account(self, t):
        for _ in range(ACCOUNT_FREE_ATTEMPTS):
            t.record_failure("dr@x.com", "1.1.1.1")
        t.record_success("dr@x.com", "1.1.1.1")
        assert t.check("dr@x.com", "1.1.1.1") is None

    def test_spraying_many_accounts_from_one_address_is_caught(self, t):
        """One guess each against a thousand accounts never trips a per-account
        limit, because no account sees more than one failure."""
        for i in range(IP_FREE_ATTEMPTS):
            t.record_failure(f"clinic{i}@x.com", "7.7.7.7")
        cooling = t.check("someone-new@x.com", "7.7.7.7")
        assert cooling is not None and cooling[1] == "ip"

    def test_a_spraying_address_does_not_block_everyone_else(self, t):
        for i in range(IP_FREE_ATTEMPTS):
            t.record_failure(f"clinic{i}@x.com", "7.7.7.7")
        assert t.check("dr@x.com", "8.8.8.8") is None

    def test_the_lock_expires(self, t, monkeypatch):
        for _ in range(ACCOUNT_FREE_ATTEMPTS):
            t.record_failure("dr@x.com", "1.1.1.1")
        assert t.check("dr@x.com", "1.1.1.1") is not None
        real = time.monotonic
        monkeypatch.setattr(time, "monotonic", lambda: real() + 3600)
        assert t.check("dr@x.com", "1.1.1.1") is None

    def test_repeat_offenders_wait_longer_each_time(self, t):
        waits = []
        for _round in range(3):
            for _ in range(ACCOUNT_FREE_ATTEMPTS):
                t.record_failure("dr@x.com", "1.1.1.1")
            waits.append(t.check("dr@x.com", "1.1.1.1")[0])
        assert waits[0] < waits[1] < waits[2]


class TestLockoutMessage:
    def test_it_says_how_long(self):
        """The wait is the whole point: a number somebody can watch tick down
        reads as a queue, where a bare refusal reads as a locked door."""
        assert "60 seconds" in lockout_message(60, "account")

    def test_long_waits_are_given_in_minutes(self):
        assert "5 minutes" in lockout_message(300, "account")

    def test_a_network_block_says_network(self):
        assert "network" in lockout_message(300, "ip")
