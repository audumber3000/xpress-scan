"""The fields behind the KPI cards' lower sections (bars, meters, rows)."""
from datetime import datetime, timedelta, date


def test_dashboard_all_time_is_not_comparable_and_series_match_buckets(client, auth_headers):
    all_time = client.get("/api/v1/dashboard/metrics?period=all", headers=auth_headers).json()
    assert all_time["comparable"] is False

    month = client.get("/api/v1/dashboard/metrics?period=month", headers=auth_headers).json()
    assert month["comparable"] is True
    n = len(month["total_patients"]["series"])
    assert n >= 1 and len(month["revenue"]["series"]) == n
    assert len(month["series_labels"]) == 2
    for key in ("upcoming", "unmarked", "scheduled"):
        assert key in month["appointments"]
    assert "over_90_count" in month["outstanding"]
    assert "returning" in month["total_patients"]

    # A single day is shown by clinic-local hour, clinic hours by default.
    today = client.get("/api/v1/dashboard/metrics?period=today", headers=auth_headers).json()
    assert today["series_granularity"] == "hour"
    assert today["series_labels"] == ["9am", "8pm"]
    assert len(today["revenue"]["series"]) == 12 == len(today["total_patients"]["series"])

    # A clinic under three months old gets the last 30 days on All time.
    assert all_time["series_granularity"] == "day_fallback"
    assert all_time["series_labels"] == ["30 days ago", "today"]
    assert len(all_time["revenue"]["series"]) == 30


def test_today_revenue_lands_in_its_clinic_hour(client, auth_headers, db_session, test_clinic, test_patient):
    from datetime import date as _date
    from core.clinic_time import clinic_today, clinic_day_bounds_utc
    from models import Invoice, InvoicePayment
    inv = Invoice(clinic_id=test_clinic.id, patient_id=test_patient.id, invoice_number="INV-H-1",
                  status="paid_verified", total=500, paid_amount=500, due_amount=0)
    db_session.add(inv)
    db_session.commit()
    day = clinic_today(test_clinic)
    start_utc, _ = clinic_day_bounds_utc(test_clinic, day, day)
    # 11:00 clinic time on the clinic's today.
    db_session.add(InvoicePayment(invoice_id=inv.id, clinic_id=test_clinic.id, amount=500,
                                  paid_on=day, method="Cash", created_at=start_utc + timedelta(hours=11)))
    db_session.commit()
    d = client.get("/api/v1/dashboard/metrics?period=today", headers=auth_headers).json()
    series = d["revenue"]["series"]
    # The range starts at 9am unless something (the test patient, created
    # just now) happened earlier, so read the position off the first label.
    first = d["series_labels"][0]
    first_hour = int(first[:-2]) % 12 + (12 if first.endswith("pm") else 0)
    assert series[11 - first_hour] == 500
    assert sum(series) == 500
    assert d["revenue"]["peak_label"] == "11am"


def test_dashboard_splits_unmarked_from_upcoming(client, auth_headers, db_session, test_clinic, test_patient):
    from models import Appointment
    now = datetime.utcnow()
    common = dict(clinic_id=test_clinic.id, patient_id=test_patient.id, patient_name="P",
                  start_time="10:00", end_time="10:30")
    db_session.add_all([
        Appointment(appointment_date=now - timedelta(days=1), status="scheduled", **common),
        Appointment(appointment_date=now.replace(hour=23, minute=59), status="scheduled", **common),
    ])
    db_session.commit()
    # A week, not today: "an hour ago" is yesterday just after midnight UTC.
    appt = client.get("/api/v1/dashboard/metrics?period=7days", headers=auth_headers).json()["appointments"]
    assert appt["unmarked"] >= 1
    assert appt["upcoming"] >= 1
    assert appt["unmarked"] + appt["upcoming"] == appt["scheduled"]


def test_payment_plan_totals_cover_only_open_plans(client, auth_headers, db_session, test_clinic, test_patient):
    from models import Invoice, InvoicePayment
    inv = Invoice(clinic_id=test_clinic.id, patient_id=test_patient.id, invoice_number="INV-T-1",
                  status="partially_paid", total=1000, paid_amount=300, due_amount=700)
    db_session.add(inv)
    db_session.commit()
    db_session.add_all([
        InvoicePayment(invoice_id=inv.id, clinic_id=test_clinic.id, amount=100, paid_on=date.today(), method="Cash"),
        InvoicePayment(invoice_id=inv.id, clinic_id=test_clinic.id, amount=200, paid_on=date.today(), method="UPI"),
    ])
    db_session.commit()
    s = client.get("/api/v1/invoices/summary", headers=auth_headers).json()
    assert s["plans"]["open"] == 1
    assert s["plans"]["paid_total"] == 300
    assert s["plans"]["due_total"] == 700
    assert s["plans"]["plan_median"] == 2
    assert "collected_issued" in s and "over_90_count" in s["outstanding"]


def test_inventory_counts_an_item_once_and_values_by_category(client, auth_headers, db_session, test_clinic):
    from models import InventoryItem
    db_session.add_all([
        # Low AND expired: must count once in flagged_items.
        InventoryItem(clinic_id=test_clinic.id, name="Gloves", category="Consumables", quantity=1,
                      min_stock_level=5, price_per_unit=10, expiry_date=date.today() - timedelta(days=2)),
        InventoryItem(clinic_id=test_clinic.id, name="Burs", category="Instruments", quantity=4,
                      min_stock_level=0, price_per_unit=50),
    ])
    db_session.commit()
    s = client.get("/api/v1/inventory/summary", headers=auth_headers).json()
    assert s["attention"]["low"] == 1 and s["attention"]["expired"] == 1
    assert s["attention"]["flagged_items"] == 1
    assert len(s["movement"]["out_series"]) == 4
    cats = {c["category"]: c["value"] for c in s["setup"]["value_by_category"]}
    assert cats == {"Instruments": 200, "Consumables": 10}

    d = client.get("/api/v1/inventory/kpi-detail?metric=value", headers=auth_headers)
    assert d.status_code == 200
    assert d.json()["is_money"] is True and len(d.json()["rows"]) == 2


def test_lab_counts_cases_due_soon(client, auth_headers, db_session, test_clinic, test_patient):
    from models import LabOrder, Vendor
    v = Vendor(clinic_id=test_clinic.id, name="Lab A", category="lab")
    db_session.add(v)
    db_session.commit()
    now = datetime.utcnow()
    db_session.add_all([
        LabOrder(clinic_id=test_clinic.id, patient_id=test_patient.id, vendor_id=v.id, work_type="Crown",
                 status="Sent", due_date=now + timedelta(days=1)),
        LabOrder(clinic_id=test_clinic.id, patient_id=test_patient.id, vendor_id=v.id, work_type="Bridge",
                 status="Sent", due_date=now + timedelta(days=10)),
    ])
    db_session.commit()
    s = client.get("/api/v1/clinical/lab-orders/summary", headers=auth_headers).json()
    assert s["open"]["count"] == 2
    assert s["open"]["due_soon"] == 1
