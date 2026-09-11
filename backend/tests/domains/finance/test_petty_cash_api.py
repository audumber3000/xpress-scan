"""The cash drawer.

Two things here are worth more than the rest of the feature:

  * the balance is `SUM(amount)` and nothing else, so no stored figure can
    contradict the movements it came from, and
  * closing the day RECORDS the variance and does not correct it. A drawer
    short by 200 is a fact about the day; a silent correction leaves the
    balance right and destroys the only evidence anything happened.
"""
import datetime

import pytest

from models import Expense, PettyCashClose, PettyCashEntry

TODAY = datetime.date.today()


def entry(client, auth_headers, kind, amount, **over):
    body = {"kind": kind, "amount": amount}
    body.update(over)
    return client.post("/api/v1/petty-cash", json=body, headers=auth_headers)


def balance(client, auth_headers):
    return client.get("/api/v1/petty-cash/balance", headers=auth_headers).json()["balance"]


# ── Auth ────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/petty-cash"),
    ("post", "/api/v1/petty-cash"),
    ("get", "/api/v1/petty-cash/balance"),
    ("get", "/api/v1/petty-cash/closes"),
    ("post", "/api/v1/petty-cash/close"),
    ("delete", "/api/v1/petty-cash/1"),
])
def test_requires_auth(client, method, path):
    kwargs = {"json": {}} if method == "post" else {}
    r = getattr(client, method)(path, **kwargs)
    assert r.status_code in (401, 403), f"{method.upper()} {path} -> {r.status_code}"


# ── The running balance ─────────────────────────────────────────────────────

def test_an_empty_drawer_is_zero_not_an_error(client, auth_headers):
    assert balance(client, auth_headers) == 0.0


def test_top_ups_and_spends_produce_the_right_balance(client, auth_headers):
    entry(client, auth_headers, "top_up", 5000.0)
    entry(client, auth_headers, "spend", 1200.0, description="Courier")
    entry(client, auth_headers, "spend", 300.0, description="Milk and tea")
    assert balance(client, auth_headers) == 3500.0


def test_the_api_applies_the_sign_so_a_top_up_cannot_reduce_the_float(
        client, auth_headers, db_session, test_clinic):
    """Amounts go in positive and the kind decides direction. A top-up that
    somehow drains the drawer is not expressible."""
    entry(client, auth_headers, "top_up", 1000.0)
    entry(client, auth_headers, "spend", 400.0)
    rows = {e.kind: e.amount for e in db_session.query(PettyCashEntry).filter(
        PettyCashEntry.clinic_id == test_clinic.id).all()}
    assert rows["top_up"] == 1000.0
    assert rows["spend"] == -400.0


def test_an_adjustment_can_go_either_way(client, auth_headers):
    """A recount that finds more than expected is as real as one that finds
    less, so this is the one kind that takes a direction."""
    entry(client, auth_headers, "top_up", 1000.0)
    entry(client, auth_headers, "adjustment", 50.0, increases_float=False)
    assert balance(client, auth_headers) == 950.0
    entry(client, auth_headers, "adjustment", 20.0, increases_float=True)
    assert balance(client, auth_headers) == 970.0


def test_spending_more_than_the_drawer_holds_is_refused(client, auth_headers):
    """A drawer cannot hold less than nothing. Refusing here turns "the balance
    looks wrong" into "this spend is the one that does not fit"."""
    entry(client, auth_headers, "top_up", 500.0)
    r = entry(client, auth_headers, "spend", 800.0)
    assert r.status_code == 400
    assert "float" in r.json()["detail"].lower()
    assert balance(client, auth_headers) == 500.0


def test_an_unknown_kind_is_refused(client, auth_headers):
    assert entry(client, auth_headers, "withdrawal", 100.0).status_code == 400


def test_a_zero_or_negative_amount_is_refused(client, auth_headers):
    assert entry(client, auth_headers, "top_up", 0).status_code == 422
    assert entry(client, auth_headers, "top_up", -50).status_code == 422


# ── The link to the ledger ──────────────────────────────────────────────────

def test_a_spend_writes_an_expense(client, auth_headers, db_session, test_clinic):
    entry(client, auth_headers, "top_up", 2000.0)
    entry(client, auth_headers, "spend", 750.0, description="Courier",
          category="Printing & stationery")

    rows = db_session.query(Expense).filter(Expense.clinic_id == test_clinic.id).all()
    assert len(rows) == 1
    assert rows[0].amount == 750.0
    assert rows[0].category == "Printing & stationery"
    assert rows[0].from_petty_cash is True
    assert rows[0].payment_method == "Cash"


def test_a_top_up_writes_no_expense(client, auth_headers, db_session, test_clinic):
    """It moves money from the bank into the drawer. Booking it as a cost would
    count the same rupee twice — once going in, again when it is spent."""
    entry(client, auth_headers, "top_up", 5000.0)
    assert db_session.query(Expense).filter(Expense.clinic_id == test_clinic.id).count() == 0


def test_deleting_a_spend_removes_its_expense_and_restores_the_balance(
        client, auth_headers, db_session, test_clinic):
    entry(client, auth_headers, "top_up", 2000.0)
    spend = entry(client, auth_headers, "spend", 500.0).json()
    assert balance(client, auth_headers) == 1500.0

    r = client.delete(f"/api/v1/petty-cash/{spend['id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["balance"] == 2000.0
    assert db_session.query(Expense).filter(Expense.clinic_id == test_clinic.id).count() == 0


# ── The list and its running balance ────────────────────────────────────────

def test_the_list_carries_a_running_balance_per_row(client, auth_headers):
    entry(client, auth_headers, "top_up", 1000.0)
    entry(client, auth_headers, "spend", 200.0)
    entry(client, auth_headers, "spend", 300.0)

    data = client.get("/api/v1/petty-cash", headers=auth_headers).json()
    # Newest first, so the balances read downward as the drawer emptied.
    assert [r["balance_after"] for r in data["items"]] == [500.0, 800.0, 1000.0]
    assert data["balance"] == 500.0
    assert data["topped_up"] == 1000.0
    assert data["spent"] == 500.0


def test_a_back_dated_entry_reorders_the_running_balance(client, auth_headers):
    """The balance per row is computed forward on read, never stored: a stored
    column would leave every row before the back-dated one quietly wrong."""
    entry(client, auth_headers, "top_up", 1000.0)
    entry(client, auth_headers, "spend", 100.0,
          occurred_on=(TODAY - datetime.timedelta(days=3)).isoformat())

    # The spend is dated earlier, so it is applied first and the top-up lands
    # on top of it — even though it was entered second.
    items = client.get("/api/v1/petty-cash", headers=auth_headers).json()["items"]
    assert [r["balance_after"] for r in items] == [900.0, -100.0]


# ── The day close ───────────────────────────────────────────────────────────

def test_a_close_records_the_variance(client, auth_headers):
    entry(client, auth_headers, "top_up", 1000.0)
    entry(client, auth_headers, "spend", 250.0)

    r = client.post("/api/v1/petty-cash/close",
                    json={"counted_amount": 700.0}, headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["expected_amount"] == 750.0
    assert data["counted_amount"] == 700.0
    assert data["variance"] == -50.0


def test_a_close_does_not_silently_correct_the_float(client, auth_headers):
    """This is the whole point. Making the variance disappear would leave the
    balance right and the discrepancy unrecorded."""
    entry(client, auth_headers, "top_up", 1000.0)
    client.post("/api/v1/petty-cash/close",
                json={"counted_amount": 800.0}, headers=auth_headers)
    assert balance(client, auth_headers) == 1000.0


def test_a_surplus_is_recorded_as_readily_as_a_shortfall(client, auth_headers):
    entry(client, auth_headers, "top_up", 1000.0)
    data = client.post("/api/v1/petty-cash/close",
                       json={"counted_amount": 1100.0}, headers=auth_headers).json()
    assert data["variance"] == 100.0


def test_a_day_can_only_be_closed_once(client, auth_headers):
    entry(client, auth_headers, "top_up", 1000.0)
    client.post("/api/v1/petty-cash/close", json={"counted_amount": 1000.0},
                headers=auth_headers)
    r = client.post("/api/v1/petty-cash/close", json={"counted_amount": 900.0},
                    headers=auth_headers)
    assert r.status_code == 400


def test_the_close_counts_only_movements_up_to_that_day(client, auth_headers):
    """Closing yesterday must not be judged against money that went in today."""
    yesterday = TODAY - datetime.timedelta(days=1)
    entry(client, auth_headers, "top_up", 500.0, occurred_on=yesterday.isoformat())
    entry(client, auth_headers, "top_up", 900.0)   # today

    data = client.post("/api/v1/petty-cash/close",
                       json={"counted_amount": 500.0, "closed_on": yesterday.isoformat()},
                       headers=auth_headers).json()
    assert data["expected_amount"] == 500.0
    assert data["variance"] == 0.0


def test_the_balance_endpoint_reports_the_last_close(client, auth_headers):
    entry(client, auth_headers, "top_up", 1000.0)
    client.post("/api/v1/petty-cash/close", json={"counted_amount": 950.0},
                headers=auth_headers)

    data = client.get("/api/v1/petty-cash/balance", headers=auth_headers).json()
    assert data["last_close"]["variance"] == -50.0
    assert data["last_close"]["counted_amount"] == 950.0


def test_closes_are_listed_newest_first(client, auth_headers, db_session, test_clinic):
    entry(client, auth_headers, "top_up", 1000.0)
    for offset in (3, 2, 1):
        day = TODAY - datetime.timedelta(days=offset)
        client.post("/api/v1/petty-cash/close",
                    json={"counted_amount": 1000.0, "closed_on": day.isoformat()},
                    headers=auth_headers)

    items = client.get("/api/v1/petty-cash/closes", headers=auth_headers).json()["items"]
    assert [i["closed_on"] for i in items] == [
        (TODAY - datetime.timedelta(days=n)).isoformat() for n in (1, 2, 3)
    ]
