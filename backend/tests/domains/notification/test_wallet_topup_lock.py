"""The wallet top-up must never hold its row lock past the point it is done.

On 2026-09-21 production was down for 23 minutes because of this. /wallet/verify
found an order already credited and returned while its SELECT ... FOR UPDATE
lock was still held, since nothing ended the transaction until the request's
session was torn down. The webhook then asked for the same lock on the event
loop, the frozen loop could not run that teardown, and every request the
server had stopped.

These tests use real committed rows on two separate connections, not the
per-test db_session fixture: that fixture runs each test inside one outer
transaction, which a second connection cannot see and which keeps every lock
alive until the test ends regardless of what the code under test does.
"""
import os
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from domains.notification.routes.notification_admin import _credit_wallet_topup


@pytest.fixture
def committed_order(test_db):
    """A clinic and a wallet order, committed for real, and removed after."""
    url = (f"postgresql://{os.environ['LOCAL_DB_USER']}:{os.environ['LOCAL_DB_PASSWORD']}"
           f"@{os.environ['LOCAL_DB_HOST']}:{os.environ['LOCAL_DB_PORT']}/{os.environ['LOCAL_DB_NAME']}")
    engine = create_engine(url)
    Session = sessionmaker(bind=engine)

    # Raw SQL for the setup rows, so this test depends on the wallet table's
    # shape and nothing else. An ORM Clinic insert names every mapped column,
    # which ties a locking test to whatever the clinics table looks like today.
    order_id = f"WALLET_LOCKTEST_{uuid.uuid4().hex[:10]}"
    with engine.begin() as conn:
        clinic_id = conn.execute(text(
            "INSERT INTO clinics (name) VALUES ('Wallet lock test') RETURNING id")).scalar()
        conn.execute(text(
            "INSERT INTO wallet_transactions (clinic_id, amount, transaction_type, description, order_id, status) "
            "VALUES (:c, 100, 'credit', 'lock test', :o, 'completed')"), {"c": clinic_id, "o": order_id})

    yield engine, Session, order_id

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM wallet_transactions WHERE order_id = :o"), {"o": order_id})
        conn.execute(text("DELETE FROM notification_wallets WHERE clinic_id = :c"), {"c": clinic_id})
        conn.execute(text("DELETE FROM clinics WHERE id = :c"), {"c": clinic_id})
    engine.dispose()


def _lock_from_another_connection(engine, order_id):
    """Try to take the row lock, refusing to wait. Raises if it is still held."""
    with engine.connect() as other:
        other.execute(text(
            "SELECT id FROM wallet_transactions WHERE order_id = :o FOR UPDATE NOWAIT"
        ), {"o": order_id})
        other.rollback()


def test_an_already_credited_order_releases_the_lock_before_returning(committed_order):
    engine, Session, order_id = committed_order
    first = Session()
    try:
        assert _credit_wallet_topup(first, order_id) is None
        # `first` has returned but is deliberately NOT closed: that is the state
        # the request was in while waiting for its teardown. The lock must
        # already be free.
        _lock_from_another_connection(engine, order_id)
    finally:
        first.close()


def test_an_unknown_order_holds_no_lock_either(committed_order):
    engine, Session, order_id = committed_order
    first = Session()
    try:
        assert _credit_wallet_topup(first, "WALLET_DOES_NOT_EXIST") is None
        _lock_from_another_connection(engine, order_id)
    finally:
        first.close()
