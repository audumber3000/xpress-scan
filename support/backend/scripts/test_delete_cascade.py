#!/usr/bin/env python3
"""
DRY-RUN: Simulate owner-delete cascade in a ROLLBACK transaction on prod DB.

Usage:
    python scripts/test_delete_cascade.py <owner_user_id>

Opens a transaction, runs the full cascade against the target owner's clinics
+ users, prints row counts per step, then ROLLBACKs. No data is modified.
"""
import sys
import os
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from database import SessionLocal  # noqa: E402
from sqlalchemy import text  # noqa: E402


def discover(db, owner_id):
    """Return (clinic_ids, user_ids, user_info[]) for the target owner."""
    rows = db.execute(text("""
        SELECT DISTINCT uc.clinic_id FROM user_clinics uc
        WHERE uc.user_id = :o AND uc.role = 'clinic_owner' AND uc.is_active = true
    """), {"o": owner_id}).fetchall()
    clinic_ids = sorted({r[0] for r in rows})

    rows2 = db.execute(text("""
        SELECT clinic_id FROM users WHERE id = :o AND clinic_id IS NOT NULL
    """), {"o": owner_id}).fetchall()
    for r in rows2:
        if r[0] not in clinic_ids:
            clinic_ids.append(r[0])

    if not clinic_ids:
        return [], [], []

    user_rows = db.execute(text("""
        SELECT DISTINCT u.id, u.email, u.role FROM users u
        WHERE (
            u.id = :o
            OR u.clinic_id = ANY(:c)
            OR u.id IN (SELECT user_id FROM user_clinics WHERE clinic_id = ANY(:c))
        )
        AND NOT EXISTS (
            SELECT 1 FROM user_clinics uc
            WHERE uc.user_id = u.id
              AND uc.clinic_id != ALL(:c)
              AND uc.is_active = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM users u2
            WHERE u2.id = u.id
              AND u2.clinic_id IS NOT NULL
              AND u2.clinic_id != ALL(:c)
        )
    """), {"o": owner_id, "c": clinic_ids}).fetchall()

    user_ids = sorted({r[0] for r in user_rows})
    user_info = [(r[0], r[1], r[2]) for r in user_rows]
    return clinic_ids, user_ids, user_info


def run_cascade(db, clinic_ids, user_ids):
    c = clinic_ids
    u = user_ids if user_ids else [-1]

    def run(label, sql):
        result = db.execute(text(sql), {"c": c, "u": u})
        print(f"  [{result.rowcount:>6}]  {label}")

    print("\n-- Step 1: invoice children")
    run("invoice_audit_logs", "DELETE FROM invoice_audit_logs WHERE invoice_id IN (SELECT id FROM invoices WHERE clinic_id = ANY(:c))")
    run("invoice_line_items", "DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE clinic_id = ANY(:c))")

    print("\n-- Step 2: patient children")
    run("lab_orders",        "DELETE FROM lab_orders WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))")
    run("patient_consents",  "DELETE FROM patient_consents WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))")
    run("patient_documents", "DELETE FROM patient_documents WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))")
    run("xray_images",       "DELETE FROM xray_images WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))")
    run("prescriptions",     "DELETE FROM prescriptions WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))")
    run("case_papers",       "DELETE FROM case_papers WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))")
    run("payments",          "DELETE FROM payments WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))")
    run("reports",           "DELETE FROM reports WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))")

    print("\n-- Step 3: whatsapp_messages")
    run("whatsapp_messages", "DELETE FROM whatsapp_messages WHERE chat_id IN (SELECT id FROM whatsapp_chats WHERE clinic_id = ANY(:c))")

    print("\n-- Step 4: support_messages")
    run("support_messages",  "DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE clinic_id = ANY(:c))")

    print("\n-- Step 5: growth_lead_activities")
    run("growth_lead_activities", "DELETE FROM growth_lead_activities WHERE lead_id IN (SELECT id FROM growth_leads WHERE clinic_id = ANY(:c))")

    print("\n-- Step 6: subscription_payments")
    run("subscription_payments", "DELETE FROM subscription_payments WHERE subscription_id IN (SELECT id FROM subscriptions WHERE clinic_id = ANY(:c) OR user_id = ANY(:u))")

    print("\n-- Step 7: direct clinic_id tables")
    for tbl in [
        "invoices", "appointments", "patients",
        "notification_logs", "notification_preferences",
        "wallet_transactions", "notification_wallets",
        "google_reviews", "google_place_links",
        "activity_logs", "support_tickets", "growth_leads",
        "message_templates", "scheduled_messages",
        "whatsapp_chats", "competitor_snapshots", "competitor_caches",
        "dashboard_reports", "clinical_settings",
        "expenses", "inventory_items", "attendance",
        "vendors", "referring_doctors",
        "template_configurations", "treatment_types",
        "consent_templates", "medications",
    ]:
        run(tbl, f"DELETE FROM {tbl} WHERE clinic_id = ANY(:c)")

    print("\n-- Step 8: subscriptions")
    run("subscriptions", "DELETE FROM subscriptions WHERE clinic_id = ANY(:c) OR user_id = ANY(:u)")

    print("\n-- Step 9: user_clinics")
    run("user_clinics", "DELETE FROM user_clinics WHERE clinic_id = ANY(:c) OR user_id = ANY(:u)")

    print("\n-- Step 10: null cross-clinic user FKs, then delete users")
    run("NULL appointments.doctor_id",  "UPDATE appointments SET doctor_id = NULL WHERE doctor_id = ANY(:u)")
    run("NULL appointments.created_by", "UPDATE appointments SET created_by = NULL WHERE created_by = ANY(:u)")
    run("NULL case_papers.dentist_id",  "UPDATE case_papers SET dentist_id = NULL WHERE dentist_id = ANY(:u)")
    run("NULL google_place_links.linked_by", "UPDATE google_place_links SET linked_by = NULL WHERE linked_by = ANY(:u)")
    run("user_devices", "DELETE FROM user_devices WHERE user_id = ANY(:u)")
    run("users",        "DELETE FROM users WHERE id = ANY(:u)")

    print("\n-- Step 11: null self-FK, then delete clinics")
    run("NULL clinics.parent_clinic_id (external)", "UPDATE clinics SET parent_clinic_id = NULL WHERE parent_clinic_id = ANY(:c) AND id != ALL(:c)")
    run("clinics", "DELETE FROM clinics WHERE id = ANY(:c)")


def post_check(db, clinic_ids, user_ids):
    """After cascade, verify nothing references the deleted clinics/users."""
    c = clinic_ids
    u = user_ids if user_ids else [-1]

    fk_rows = db.execute(text("""
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name IN ('clinics', 'users')
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
    """)).fetchall()

    issues = []
    for tbl, col, ftbl in fk_rows:
        target = c if ftbl == "clinics" else u
        param = "c" if ftbl == "clinics" else "u"
        try:
            n = db.execute(
                text(f"SELECT COUNT(*) FROM {tbl} WHERE {col} = ANY(:{param})"),
                {param: target},
            ).scalar()
        except Exception as e:
            issues.append(f"  ❌ {tbl}.{col} (FK -> {ftbl}): query failed: {e}")
            continue
        if n and n > 0:
            issues.append(f"  ❌ {tbl}.{col} still has {n} rows referencing deleted {ftbl}")

    if issues:
        print("\n⚠️  Post-cascade FK leftovers:")
        for line in issues:
            print(line)
    else:
        print("\n✅ Post-cascade: no dangling FK references to deleted clinics or users.")


def main():
    if len(sys.argv) < 2:
        print("Usage: test_delete_cascade.py <owner_user_id>")
        sys.exit(1)
    owner_id = int(sys.argv[1])

    db = SessionLocal()
    try:
        print(f"=== DRY-RUN cascade for owner user_id={owner_id} ===")
        clinic_ids, user_ids, user_info = discover(db, owner_id)
        print(f"Target clinics: {clinic_ids}")
        print(f"Users to delete ({len(user_info)}):")
        for uid, email, role in user_info:
            print(f"  - id={uid:<4} role={role:<15} email={email}")

        if not clinic_ids:
            print("No clinics found for this owner. Aborting.")
            return

        try:
            run_cascade(db, clinic_ids, user_ids)
            post_check(db, clinic_ids, user_ids)
            print("\n✅ Cascade completed without error.")
        except Exception as e:
            print(f"\n❌ Cascade raised: {type(e).__name__}: {e}")
            traceback.print_exc()
        finally:
            db.rollback()
            print("\n↩️  Transaction rolled back. No data changed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
