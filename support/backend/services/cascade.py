"""FK-safe cascade deletion for clinics + their related data + users.

Validated via scripts/test_delete_cascade.py against the prod DB (ROLLBACK).
The order below matches the prod FK graph: children -> parents, with cross-clinic
user FKs NULLed (where nullable) and the clinics.parent_clinic_id self-FK NULLed
for clinics that aren't themselves being deleted.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session


def discover_owner_scope(db: Session, owner_user_id: int):
    """Return (clinic_ids, user_ids, user_info) for a given owner.

    user_ids only includes users exclusively linked to the owner's clinics —
    users still active in other clinics are left untouched.
    """
    rows = db.execute(text("""
        SELECT DISTINCT uc.clinic_id FROM user_clinics uc
        WHERE uc.user_id = :o AND uc.role = 'clinic_owner' AND uc.is_active = true
    """), {"o": owner_user_id}).fetchall()
    clinic_ids = sorted({r[0] for r in rows})

    rows2 = db.execute(text(
        "SELECT clinic_id FROM users WHERE id = :o AND clinic_id IS NOT NULL"
    ), {"o": owner_user_id}).fetchall()
    for r in rows2:
        if r[0] not in clinic_ids:
            clinic_ids.append(r[0])

    if not clinic_ids:
        return [], [], []

    user_rows = db.execute(text("""
        SELECT DISTINCT u.id, u.email, u.role, u.name, u.supabase_user_id
        FROM users u
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
    """), {"o": owner_user_id, "c": clinic_ids}).fetchall()

    user_ids = sorted({r[0] for r in user_rows})
    user_info = [
        {"id": r[0], "email": r[1], "role": r[2], "name": r[3], "firebase_uid": r[4]}
        for r in user_rows
    ]
    return clinic_ids, user_ids, user_info


def cascade_delete_clinics(db: Session, clinic_ids: list, user_ids: list) -> None:
    """Execute the full delete cascade. Caller commits/rolls back."""
    if not clinic_ids:
        return
    c = list(clinic_ids)
    u = list(user_ids) if user_ids else [-1]

    # Step 1: invoice children
    db.execute(text("DELETE FROM invoice_audit_logs WHERE invoice_id IN (SELECT id FROM invoices WHERE clinic_id = ANY(:c))"), {"c": c})
    db.execute(text("DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE clinic_id = ANY(:c))"), {"c": c})

    # Step 2: patient children (lab_orders first — references case_papers + patients)
    for sql in [
        "DELETE FROM lab_orders WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))",
        "DELETE FROM patient_consents WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))",
        "DELETE FROM patient_documents WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))",
        "DELETE FROM xray_images WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))",
        "DELETE FROM prescriptions WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))",
        "DELETE FROM case_papers WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))",
        "DELETE FROM payments WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))",
        "DELETE FROM reports WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ANY(:c))",
    ]:
        db.execute(text(sql), {"c": c})

    # Step 3-5: other parent->child
    db.execute(text("DELETE FROM whatsapp_messages WHERE chat_id IN (SELECT id FROM whatsapp_chats WHERE clinic_id = ANY(:c))"), {"c": c})
    db.execute(text("DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE clinic_id = ANY(:c))"), {"c": c})
    db.execute(text("DELETE FROM growth_lead_activities WHERE lead_id IN (SELECT id FROM growth_leads WHERE clinic_id = ANY(:c))"), {"c": c})

    # Step 6: subscription_payments before subscriptions
    db.execute(text(
        "DELETE FROM subscription_payments WHERE subscription_id IN "
        "(SELECT id FROM subscriptions WHERE clinic_id = ANY(:c) OR user_id = ANY(:u))"
    ), {"c": c, "u": u})

    # Step 7: all direct clinic_id tables
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
        db.execute(text(f"DELETE FROM {tbl} WHERE clinic_id = ANY(:c)"), {"c": c})

    # Step 8-9: subscriptions + user_clinics
    db.execute(text("DELETE FROM subscriptions WHERE clinic_id = ANY(:c) OR user_id = ANY(:u)"), {"c": c, "u": u})
    db.execute(text("DELETE FROM user_clinics WHERE clinic_id = ANY(:c) OR user_id = ANY(:u)"), {"c": c, "u": u})

    # Step 10: NULL cross-clinic user FKs (nullable columns) then delete users
    db.execute(text("UPDATE appointments SET doctor_id = NULL WHERE doctor_id = ANY(:u)"), {"u": u})
    db.execute(text("UPDATE appointments SET created_by = NULL WHERE created_by = ANY(:u)"), {"u": u})
    db.execute(text("UPDATE case_papers SET dentist_id = NULL WHERE dentist_id = ANY(:u)"), {"u": u})
    db.execute(text("UPDATE google_place_links SET linked_by = NULL WHERE linked_by = ANY(:u)"), {"u": u})
    db.execute(text("DELETE FROM user_devices WHERE user_id = ANY(:u)"), {"u": u})
    db.execute(text("DELETE FROM users WHERE id = ANY(:u)"), {"u": u})

    # Step 11: clinics self-FK then clinics
    db.execute(text(
        "UPDATE clinics SET parent_clinic_id = NULL "
        "WHERE parent_clinic_id = ANY(:c) AND id != ALL(:c)"
    ), {"c": c})
    db.execute(text("DELETE FROM clinics WHERE id = ANY(:c)"), {"c": c})
