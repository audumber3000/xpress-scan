#!/bin/bash
set -e

# ==============================================================================
#  MolarPlus Backend — AWS Deploy Script (EC2 + RDS)
#
#  Differs from deploy.sh (Hetzner) in ONE way:
#  there is no `db` container — Postgres is RDS. So every migration / schema
#  check runs through `psql "$DATABASE_URL"` instead of `docker exec molarplus-db-1`.
#
#  Requirements on the EC2 host:
#    - postgresql-client installed (`apt-get install -y postgresql-client`)
#    - DATABASE_URL in .env.production points at the RDS endpoint
#      (password '@' must be encoded as %40)
#    - the EC2 security group can reach RDS on 5432
# ==============================================================================

echo "======================================"
echo "  MolarPlus Backend — AWS Deploy"
echo "======================================"

COMPOSE_FILE="docker-compose.aws.yml"

# ── Pre-deploy checks ─────────────────────────────────────────────────────────
echo ""
echo "▶ Running pre-deploy checks..."

ERRORS=0

if [ ! -f .env.production ]; then
  echo "  ❌ .env.production not found"
  ERRORS=$((ERRORS+1))
else
  echo "  ✅ .env.production found"

  REQUIRED_VARS="DATABASE_URL JWT_SECRET FIREBASE_JSON_PATH R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY CASHFREE_APP_ID CASHFREE_SECRET_KEY BACKEND_URL"
  for VAR in $REQUIRED_VARS; do
    VALUE=$(grep -E "^${VAR}=" .env.production | cut -d'=' -f2-)
    if [ -z "$VALUE" ] || [ "$VALUE" = "your_${VAR,,}_here" ]; then
      echo "  ❌ $VAR is not set in .env.production"
      ERRORS=$((ERRORS+1))
    else
      echo "  ✅ $VAR is set"
    fi
  done

  DB_URL=$(grep -E "^DATABASE_URL=" .env.production | cut -d'=' -f2-)
  STRIPPED="${DB_URL#postgresql://}"
  CREDENTIALS="${STRIPPED%%@*}"
  PASSWORD="${CREDENTIALS##*:}"
  if echo "$PASSWORD" | grep -q '@'; then
    echo "  ❌ DATABASE_URL password contains a bare '@' — encode it as '%40'"
    ERRORS=$((ERRORS+1))
  else
    echo "  ✅ DATABASE_URL password encoding looks correct"
  fi

  # Guard against accidentally pointing at the old in-container host
  if echo "$DB_URL" | grep -qE '@db:5432'; then
    echo "  ❌ DATABASE_URL still points at the docker-internal 'db' host — set it to the RDS endpoint"
    ERRORS=$((ERRORS+1))
  fi

  FIREBASE_PATH=$(grep -E "^FIREBASE_JSON_PATH=" .env.production | cut -d'=' -f2-)
  if [ -f "$FIREBASE_PATH" ]; then
    echo "  ✅ Firebase JSON found at $FIREBASE_PATH"
  else
    echo "  ⚠️  Firebase JSON not found at $FIREBASE_PATH"
  fi
fi

# psql must be available on the host to reach RDS
if ! command -v psql >/dev/null 2>&1; then
  echo "  ❌ psql not found — install it: sudo apt-get install -y postgresql-client"
  ERRORS=$((ERRORS+1))
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS pre-deploy check(s) failed. Fix the issues above before deploying."
  exit 1
fi

# Load DATABASE_URL into the environment for psql
export DATABASE_URL=$(grep -E "^DATABASE_URL=" .env.production | cut -d'=' -f2-)

# Verify RDS is reachable before doing anything
echo ""
echo "▶ Verifying RDS connectivity..."
if psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "  ✅ Connected to RDS"
else
  echo "  ❌ Cannot connect to RDS via DATABASE_URL — check endpoint, SG, and credentials"
  exit 1
fi

# ── DB migrations (run against RDS) ───────────────────────────────────────────
echo ""
echo "▶ Running DB migrations against RDS..."

run_migration() {
  local label="$1"
  local ddl="$2"
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$ddl" >/dev/null 2>&1; then
    echo "  ✅ $label"
  else
    echo "  ❌ $label — failed:"
    psql "$DATABASE_URL" -c "$ddl" 2>&1 | sed 's/^/     /'
    exit 1
  fi
}

run_migration "is_trial"         "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE"
run_migration "trial_ends_at"    "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP"
run_migration "clinic_label"     "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS clinic_label VARCHAR"
run_migration "parent_clinic_id" "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS parent_clinic_id INTEGER REFERENCES clinics(id)"
run_migration "country"          "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'IN'"
run_migration "currency_code"    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'INR'"
run_migration "currency_symbol"  "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(5) DEFAULT '₹'"
run_migration "timezone"         "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata'"
run_migration "tax_label"        "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tax_label VARCHAR(20) DEFAULT 'GST No.'"
run_migration "tax_id"           "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50)"
run_migration "email_report_unsubscribed" "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_report_unsubscribed BOOLEAN DEFAULT FALSE"
run_migration "trial_used"        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE"

run_migration "feature_requests" "CREATE TABLE IF NOT EXISTS feature_requests (id SERIAL PRIMARY KEY, created_by INTEGER REFERENCES users(id), clinic_id INTEGER REFERENCES clinics(id), title VARCHAR NOT NULL, description TEXT, status VARCHAR DEFAULT 'open', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())"
run_migration "feature_request_votes" "CREATE TABLE IF NOT EXISTS feature_request_votes (id SERIAL PRIMARY KEY, feature_request_id INTEGER NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW(), CONSTRAINT uq_feature_vote UNIQUE (feature_request_id, user_id))"

run_migration "notif_provider"   "ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS provider VARCHAR DEFAULT 'msg91'"
run_migration "patient_dob"       "ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth DATE"
# Clinic Profile → License tab. Nullable, no default: existing clinics unaffected.
run_migration "license_number"    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS license_number VARCHAR(80)"
run_migration "license_authority" "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS license_authority VARCHAR(120)"
run_migration "license_expiry"    "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS license_expiry DATE"
# Support Center → My Account Manager. Set by the support team, not the clinic.
run_migration "am_name"           "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS account_manager_name VARCHAR(120)"
run_migration "am_role"           "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS account_manager_role VARCHAR(120)"
run_migration "am_email"          "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS account_manager_email VARCHAR(120)"
run_migration "am_phone"          "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS account_manager_phone VARCHAR(20)"
run_migration "whatsapp_integrations" "CREATE TABLE IF NOT EXISTS whatsapp_integrations (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL UNIQUE REFERENCES clinics(id), provider VARCHAR DEFAULT 'wareach', session_id VARCHAR, api_key_enc TEXT, phone_number VARCHAR, status VARCHAR DEFAULT 'disconnected', last_status_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())"
run_migration "inventory_transactions" "CREATE TABLE IF NOT EXISTS inventory_transactions (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), patient_id INTEGER REFERENCES patients(id), case_paper_id INTEGER REFERENCES case_papers(id), inventory_item_id INTEGER REFERENCES inventory_items(id), direction VARCHAR NOT NULL DEFAULT 'out', item_name VARCHAR NOT NULL, quantity DOUBLE PRECISION NOT NULL DEFAULT 0, unit VARCHAR, note VARCHAR, created_at TIMESTAMP DEFAULT NOW())"
run_migration "invoice_payments" "CREATE TABLE IF NOT EXISTS invoice_payments (id SERIAL PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id), clinic_id INTEGER NOT NULL REFERENCES clinics(id), amount DOUBLE PRECISION NOT NULL DEFAULT 0, paid_on DATE, method VARCHAR, note VARCHAR, created_at TIMESTAMP DEFAULT NOW())"
run_migration "invoice_payments_backfill" "INSERT INTO invoice_payments (invoice_id, clinic_id, amount, paid_on, method, note, created_at) SELECT i.id, i.clinic_id, i.paid_amount, COALESCE(i.paid_at::date, i.created_at::date), i.payment_mode, 'Existing paid amount', COALESCE(i.paid_at, i.created_at, NOW()) FROM invoices i WHERE COALESCE(i.paid_amount,0) > 0 AND NOT EXISTS (SELECT 1 FROM invoice_payments p WHERE p.invoice_id = i.id)"

run_migration "inv_batch_number" "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR"
run_migration "inv_expiry_date"  "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS expiry_date DATE"
run_migration "medication_stock" "CREATE TABLE IF NOT EXISTS medication_stock (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), vendor_id INTEGER REFERENCES vendors(id), name VARCHAR NOT NULL, generic_name VARCHAR, strength VARCHAR, form VARCHAR, quantity DOUBLE PRECISION DEFAULT 0, unit VARCHAR, min_stock_level DOUBLE PRECISION DEFAULT 0, price_per_unit DOUBLE PRECISION DEFAULT 0, batch_number VARCHAR, expiry_date DATE, schedule VARCHAR, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())"
run_migration "default_medications_seeded" "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS default_medications_seeded BOOLEAN DEFAULT FALSE"
run_migration "manual_whatsapp" "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS manual_whatsapp BOOLEAN DEFAULT FALSE"
run_migration "inv_txn_action" "ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS action VARCHAR"
run_migration "inv_txn_med_id" "ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS medication_stock_id INTEGER REFERENCES medication_stock(id)"
run_migration "medstock_pack_unit" "ALTER TABLE medication_stock ADD COLUMN IF NOT EXISTS pack_unit VARCHAR"
run_migration "medstock_units_per_pack" "ALTER TABLE medication_stock ADD COLUMN IF NOT EXISTS units_per_pack DOUBLE PRECISION"
run_migration "invoice_case_paper_id" "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS case_paper_id INTEGER REFERENCES case_papers(id)"
run_migration "inv_txn_line_item_id" "ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS invoice_line_item_id INTEGER REFERENCES invoice_line_items(id)"
run_migration "lab_order_invoice_line" "ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS invoice_line_item_id INTEGER REFERENCES invoice_line_items(id)"
# Backfill: older case-paper invoices were linked only via appointment_id (the
# case paper id was stored there before case_paper_id existed), so they never
# showed in a case paper's invoice list. Heal them by copying appointment_id ->
# case_paper_id, but ONLY when appointment_id points to a case paper of the SAME
# patient/clinic (appointment_id is overloaded and can also hold a real
# appointments.id for someone else). Idempotent: the NULL guard makes re-runs no-ops.
run_migration "backfill_invoice_case_paper" "UPDATE invoices i SET case_paper_id = i.appointment_id FROM case_papers cp WHERE i.case_paper_id IS NULL AND i.appointment_id IS NOT NULL AND cp.id = i.appointment_id AND cp.patient_id = i.patient_id AND cp.clinic_id = i.clinic_id"

# Patient registration date — back-dateable, clinic-local, and what decides
# new-vs-repeat in the daily register. Backfilled from created_at so existing
# patients are never blank.
run_migration "patient_registered_on" "ALTER TABLE patients ADD COLUMN IF NOT EXISTS registered_on DATE"
run_migration "patient_registered_on_backfill" "UPDATE patients SET registered_on = created_at::date WHERE registered_on IS NULL"

# Discounts granted after an invoice was issued (append-only, one row each).
run_migration "invoice_discounts" "CREATE TABLE IF NOT EXISTS invoice_discounts (id SERIAL PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id), clinic_id INTEGER NOT NULL REFERENCES clinics(id), value DOUBLE PRECISION NOT NULL DEFAULT 0, discount_type VARCHAR NOT NULL DEFAULT 'amount', amount DOUBLE PRECISION NOT NULL DEFAULT 0, reason VARCHAR NOT NULL, applied_by INTEGER REFERENCES users(id), applied_at TIMESTAMP DEFAULT NOW())"
run_migration "invoice_discounts_idx" "CREATE INDEX IF NOT EXISTS ix_invoice_discounts_invoice_id ON invoice_discounts (invoice_id)"

# Daily patient register — one row per patient per clinic-local day.
run_migration "daily_visits" "CREATE TABLE IF NOT EXISTS daily_visits (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), patient_id INTEGER NOT NULL REFERENCES patients(id), visit_date DATE NOT NULL, is_repeat BOOLEAN NOT NULL DEFAULT FALSE, doctor_id INTEGER REFERENCES users(id), reason VARCHAR, source VARCHAR NOT NULL DEFAULT 'manual', appointment_id INTEGER REFERENCES appointments(id), notes TEXT, created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), CONSTRAINT uq_daily_visit_patient_day UNIQUE (clinic_id, patient_id, visit_date))"
run_migration "daily_visits_day_idx" "CREATE INDEX IF NOT EXISTS ix_daily_visits_clinic_date ON daily_visits (clinic_id, visit_date)"

# ── 2026-08 release ──────────────────────────────────────────────────────────
# Letterhead tagline. Deliberately NOT backfilled: renderers used to print a
# hardcoded "Comprehensive Dental & Orthodontic Care" for every clinic because
# no such column existed. Clinics now type their own in Clinic Details.
run_migration "clinic_tagline" "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tagline VARCHAR(120)"

# Per-installment payment receipts. The PDF renders on demand, so only the
# identity and the frozen arithmetic are stored. Backfilled so every payment
# already on the books can produce a receipt with a stable number.
run_migration "payment_receipt_number"  "ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR"
run_migration "payment_receipt_paid"    "ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS receipt_paid_to_date DOUBLE PRECISION"
run_migration "payment_receipt_balance" "ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS receipt_balance_due DOUBLE PRECISION"
run_migration "payment_receipt_idx"     "CREATE INDEX IF NOT EXISTS ix_invoice_payments_receipt_number ON invoice_payments (receipt_number)"
run_migration "payment_receipt_backfill_number" "WITH numbered AS (SELECT id, to_char(COALESCE(paid_on, created_at::date), 'YYYY') AS yr, ROW_NUMBER() OVER (PARTITION BY clinic_id, to_char(COALESCE(paid_on, created_at::date), 'YYYY') ORDER BY id) AS seq FROM invoice_payments WHERE receipt_number IS NULL) UPDATE invoice_payments p SET receipt_number = 'RCP-' || n.yr || '-' || lpad(n.seq::text, 4, '0') FROM numbered n WHERE p.id = n.id"
run_migration "payment_receipt_backfill_totals" "WITH running AS (SELECT id, invoice_id, SUM(amount) OVER (PARTITION BY invoice_id ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ptd FROM invoice_payments) UPDATE invoice_payments p SET receipt_paid_to_date = r.ptd, receipt_balance_due = GREATEST(COALESCE(i.total, 0) - r.ptd, 0) FROM running r JOIN invoices i ON i.id = r.invoice_id WHERE p.id = r.id AND p.receipt_paid_to_date IS NULL"

# Template field-visibility toggles live in config_json. Both columns are older
# than this release in models.py, but create_all never ALTERs an existing table —
# so a prod table predating them would silently lack the column the save path
# now writes. Defensive and idempotent.
run_migration "tplcfg_config_json"     "ALTER TABLE template_configurations ADD COLUMN IF NOT EXISTS config_json JSON"
run_migration "tplcfg_secondary_color" "ALTER TABLE template_configurations ADD COLUMN IF NOT EXISTS secondary_color VARCHAR"

# Audit trail: who deleted or changed what, from which device. Distinct from
# activity_logs, which is a 10-row FIFO feed for the dashboard card.
run_migration "audit_logs" "CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), user_id INTEGER REFERENCES users(id), actor_name VARCHAR, actor_role VARCHAR, action VARCHAR NOT NULL, summary VARCHAR NOT NULL, entity_type VARCHAR, entity_id INTEGER, ip_address VARCHAR, user_agent VARCHAR, created_at TIMESTAMP DEFAULT NOW())"
run_migration "audit_logs_clinic_idx" "CREATE INDEX IF NOT EXISTS ix_audit_logs_clinic_created ON audit_logs (clinic_id, created_at DESC)"
run_migration "audit_logs_action_idx"  "CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action)"

# WhatsApp receipt messages need a preference row or notify_event no-ops in
# silence. Seeded enabled for every existing clinic; new clinics get it from
# DEFAULT_EVENT_TYPES.
run_migration "receipt_notification_pref" "INSERT INTO notification_preferences (clinic_id, event_type, channels, is_enabled) SELECT c.id, 'receipt_notification', '[\"whatsapp\"]'::json, TRUE FROM clinics c WHERE NOT EXISTS (SELECT 1 FROM notification_preferences p WHERE p.clinic_id = c.id AND p.event_type = 'receipt_notification')"
# mp_lab_order_placed is approved in Meta now, so lab orders are no longer
# email-only. Existing rows stay disabled; this only widens the channel list.
run_migration "lab_order_whatsapp" "UPDATE notification_preferences SET channels = '[\"whatsapp\", \"email\"]'::json WHERE event_type = 'lab_order_placed' AND channels::text = '[\"email\"]'"

# ── Case costs: lab bills and consultant fees ────────────────────────────────
# The cost side of a case. Never touches what a patient owes; settling one
# writes an Expense, which is how lab bills finally reach the ledger.
run_migration "case_costs" "CREATE TABLE IF NOT EXISTS case_costs (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), patient_id INTEGER NOT NULL REFERENCES patients(id), case_paper_id INTEGER REFERENCES case_papers(id), invoice_id INTEGER REFERENCES invoices(id), lab_order_id INTEGER REFERENCES lab_orders(id), vendor_id INTEGER REFERENCES vendors(id), doctor_user_id INTEGER REFERENCES users(id), kind VARCHAR NOT NULL DEFAULT 'lab', description VARCHAR, basis VARCHAR NOT NULL DEFAULT 'fixed', percentage DOUBLE PRECISION, amount DOUBLE PRECISION NOT NULL DEFAULT 0, status VARCHAR NOT NULL DEFAULT 'unpaid', paid_on DATE, expense_id INTEGER REFERENCES expenses(id), notes TEXT, created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())"
run_migration "case_costs_clinic_idx" "CREATE INDEX IF NOT EXISTS ix_case_costs_clinic_id ON case_costs (clinic_id)"
run_migration "case_costs_lab_order_idx" "CREATE INDEX IF NOT EXISTS ix_case_costs_lab_order_id ON case_costs (lab_order_id)"
run_migration "case_costs_patient_idx" "CREATE INDEX IF NOT EXISTS ix_case_costs_patient_id ON case_costs (patient_id)"
# These two arrived after the table did, so any DB that already has case_costs
# needs them added rather than created. CREATE TABLE IF NOT EXISTS above is a
# no-op on such a DB, which is exactly how a column goes missing.
run_migration "case_costs_doctor_user_id" "ALTER TABLE case_costs ADD COLUMN IF NOT EXISTS doctor_user_id INTEGER REFERENCES users(id)"
run_migration "case_costs_notes"          "ALTER TABLE case_costs ADD COLUMN IF NOT EXISTS notes TEXT"
run_migration "case_costs_doctor_idx"     "CREATE INDEX IF NOT EXISTS ix_case_costs_doctor_user_id ON case_costs (doctor_user_id)"

# Fee terms live on the person or vendor, set once, not typed per case. That is
# what makes the per-consultant split trustworthy.
run_migration "user_fee_basis"    "ALTER TABLE users ADD COLUMN IF NOT EXISTS fee_basis VARCHAR"
run_migration "user_fee_value"    "ALTER TABLE users ADD COLUMN IF NOT EXISTS fee_value DOUBLE PRECISION"
run_migration "vendor_fee_basis"  "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS fee_basis VARCHAR"
run_migration "vendor_fee_value"  "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS fee_value DOUBLE PRECISION"
run_migration "expense_paid_to_user" "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_to_user_id INTEGER REFERENCES users(id)"
run_migration "patient_primary_doctor" "ALTER TABLE patients ADD COLUMN IF NOT EXISTS primary_doctor_id INTEGER REFERENCES users(id)"

# ── Clinic website ───────────────────────────────────────────────────────────
# website_enabled defaults FALSE so no existing clinic is published by a deploy.
# Nothing is publicly reachable until a clinic switches it on itself.
run_migration "clinic_photos" "CREATE TABLE IF NOT EXISTS clinic_photos (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), file_path VARCHAR NOT NULL, caption VARCHAR(120), sort_order INTEGER DEFAULT 0, uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW())"
run_migration "clinic_photos_idx" "CREATE INDEX IF NOT EXISTS ix_clinic_photos_clinic_id ON clinic_photos (clinic_id)"
run_migration "website_slug"         "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS website_slug VARCHAR(80)"
run_migration "website_enabled"      "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS website_enabled BOOLEAN DEFAULT FALSE"
run_migration "website_published_at" "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS website_published_at TIMESTAMP"
run_migration "website_about"        "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS website_about TEXT"
run_migration "website_show_stats"   "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS website_show_stats BOOLEAN DEFAULT TRUE"
run_migration "website_slug_idx"     "CREATE UNIQUE INDEX IF NOT EXISTS ix_clinics_website_slug ON clinics (website_slug)"

# ── Appointments: outcomes, series, and the status rename ────────────────────
# Production held 'accepted', 'confirmed', 'checking' and 'rejected'. None of
# them said whether the patient turned up, so the no-show rate was not merely
# unreported, it was unrecordable. 165 of 167 appointments sat in the past with
# no terminal state.
run_migration "appt_outcome_at"    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMP"
run_migration "appt_outcome_by"    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS outcome_by INTEGER REFERENCES users(id)"
run_migration "appt_cancel_reason" "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR"
run_migration "appt_series_id"     "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS series_id VARCHAR"
run_migration "appt_series_idx"    "CREATE INDEX IF NOT EXISTS ix_appointments_series_id ON appointments (series_id)"
run_migration "appt_status_idx"    "CREATE INDEX IF NOT EXISTS ix_appointments_status ON appointments (status)"

# The old value is kept in its own column before anything is rewritten. This is
# the one genuinely irreversible step in the deploy, so it stays walkable-back:
# UPDATE appointments SET status = legacy_status WHERE legacy_status IS NOT NULL.
run_migration "appt_legacy_status" "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS legacy_status VARCHAR"
run_migration "appt_legacy_capture" "UPDATE appointments SET legacy_status = status WHERE legacy_status IS NULL"

# Idempotent by construction: each UPDATE only matches the old value, so a
# second run finds nothing left to change.
run_migration "appt_status_accepted"  "UPDATE appointments SET status = 'scheduled' WHERE status IN ('accepted', 'pending')"
run_migration "appt_status_checking"  "UPDATE appointments SET status = 'arrived'   WHERE status = 'checking'"
run_migration "appt_status_rejected"  "UPDATE appointments SET status = 'cancelled' WHERE status IN ('rejected', 'canceled')"
run_migration "appt_status_noshow"    "UPDATE appointments SET status = 'no_show'   WHERE status IN ('no-show', 'noshow')"
# Anything we have never seen becomes 'scheduled' rather than staying unreadable:
# an unrecognised status should leave the appointment on the calendar and
# actionable, never silently drop it out of every query.
run_migration "appt_status_unknown"   "UPDATE appointments SET status = 'scheduled' WHERE status IS NULL OR status NOT IN ('scheduled','confirmed','arrived','completed','no_show','cancelled')"

# ── Scheduling primitives ────────────────────────────────────────────────────
# A treatment now knows how long it occupies the chair. 30 rather than the old
# blanket 60, which treated a check-up and a root canal as the same length.
run_migration "tt_duration"  "ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30"
run_migration "tt_duration_backfill" "UPDATE treatment_types SET duration_minutes = 30 WHERE duration_minutes IS NULL"

# patients.treatment_type is an optional reason-for-visit label in the DTO, the
# intake form and every importer, but NOT NULL in the database, so any caller
# that omitted it got a 500 instead of a validation error. Booking a new patient
# from the calendar is the first flow that sends only a name and a phone.
run_migration "patient_treatment_type_nullable" "ALTER TABLE patients ALTER COLUMN treatment_type DROP NOT NULL"

# Signed consents carried no clinic_id, so they could only be scoped by walking
# to their patient. The list endpoint did not, and answered for any clinic.
run_migration "consent_clinic_id" "ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id)"
run_migration "consent_clinic_backfill" "UPDATE patient_consents pc SET clinic_id = p.clinic_id FROM patients p WHERE pc.patient_id = p.id AND pc.clinic_id IS NULL"
run_migration "consent_clinic_idx" "CREATE INDEX IF NOT EXISTS ix_patient_consents_clinic ON patient_consents (clinic_id)"
run_migration "consent_template_category" "ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS category VARCHAR"

# Prescription sets. A doctor picks "Root canal, day 1" instead of retyping
# the same three drugs, which is also what stops "Amoxicillin 500mq" style
# typos accumulating in patient records.
run_migration "medication_groups" "CREATE TABLE IF NOT EXISTS medication_groups (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), name VARCHAR NOT NULL, description VARCHAR, treatment_type_id INTEGER REFERENCES treatment_types(id), audience VARCHAR, is_active BOOLEAN DEFAULT TRUE, created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())"
run_migration "medication_group_items" "CREATE TABLE IF NOT EXISTS medication_group_items (id SERIAL PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES medication_groups(id) ON DELETE CASCADE, medication_stock_id INTEGER REFERENCES medication_stock(id), medicine_name VARCHAR NOT NULL, dosage VARCHAR, duration VARCHAR, quantity VARCHAR, notes VARCHAR, sort_order INTEGER DEFAULT 0)"
run_migration "medication_groups_idx" "CREATE INDEX IF NOT EXISTS ix_medication_groups_clinic ON medication_groups (clinic_id)"
run_migration "medication_group_items_idx" "CREATE INDEX IF NOT EXISTS ix_medication_group_items_group ON medication_group_items (group_id)"

# Clinic.timings says when the door is open, not who is behind it. Without
# these the grid would book a dentist onto a day they are not in the building.
run_migration "doctor_availability" "CREATE TABLE IF NOT EXISTS doctor_availability (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), doctor_id INTEGER NOT NULL REFERENCES users(id), weekday INTEGER NOT NULL, start_time VARCHAR NOT NULL, end_time VARCHAR NOT NULL, created_at TIMESTAMP DEFAULT NOW())"
run_migration "doctor_availability_idx" "CREATE INDEX IF NOT EXISTS ix_doctor_availability_lookup ON doctor_availability (clinic_id, doctor_id, weekday)"
run_migration "doctor_time_off" "CREATE TABLE IF NOT EXISTS doctor_time_off (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), doctor_id INTEGER NOT NULL REFERENCES users(id), start_date DATE NOT NULL, end_date DATE NOT NULL, start_time VARCHAR, end_time VARCHAR, reason VARCHAR, created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW())"
run_migration "doctor_time_off_idx" "CREATE INDEX IF NOT EXISTS ix_doctor_time_off_lookup ON doctor_time_off (clinic_id, doctor_id, start_date, end_date)"
run_migration "appointment_waitlist" "CREATE TABLE IF NOT EXISTS appointment_waitlist (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), patient_id INTEGER REFERENCES patients(id), patient_name VARCHAR NOT NULL, patient_phone VARCHAR, doctor_id INTEGER REFERENCES users(id), treatment VARCHAR, duration INTEGER NOT NULL DEFAULT 30, preferred_from DATE, preferred_to DATE, note VARCHAR, status VARCHAR NOT NULL DEFAULT 'waiting', booked_appointment_id INTEGER REFERENCES appointments(id), created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW())"
run_migration "appointment_waitlist_idx" "CREATE INDEX IF NOT EXISTS ix_appointment_waitlist_clinic ON appointment_waitlist (clinic_id, status)"

# ── Schema migration check (run against RDS) ──────────────────────────────────
echo ""
echo "▶ Running schema migration check against RDS..."

declare -A REQUIRED_COLS=(
  ["clinics"]="id clinic_code name address phone email gst_number specialization subscription_plan status razorpay_customer_id cashfree_customer_id logo_url invoice_template primary_color number_of_chairs timings created_at updated_at synced_at sync_status referred_by_code clinic_label parent_clinic_id country currency_code currency_symbol timezone tax_label tax_id license_number license_authority license_expiry account_manager_name account_manager_role account_manager_email account_manager_phone"
  ["users"]="id email name first_name last_name role is_active permissions created_at updated_at email_report_unsubscribed"
  ["user_clinics"]="user_id clinic_id role is_active created_at"
  ["patients"]="id clinic_id name phone date_of_birth registered_on created_at updated_at"
  ["appointments"]="id clinic_id patient_name appointment_date start_time end_time status created_at updated_at"
  ["subscriptions"]="id plan_name status current_start current_end is_trial trial_ends_at"
)

SCHEMA_OK=true
for table in "${!REQUIRED_COLS[@]}"; do
  ACTUAL=$(psql "$DATABASE_URL" -tA -c \
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='$table'" 2>/dev/null)
  if [ -z "$ACTUAL" ]; then
    echo "  ❌ Schema check could not query table '$table' — DB unreachable"
    exit 1
  fi
  for col in ${REQUIRED_COLS[$table]}; do
    if ! echo "$ACTUAL" | grep -qx "$col"; then
      echo "  ❌ $table is missing column: $col"
      SCHEMA_OK=false
    fi
  done
done

if [ "$SCHEMA_OK" = true ]; then
  echo "  ✅ Schema check passed — all required columns exist"
else
  echo ""
  echo "  Run the missing ALTER TABLE migrations on RDS before deploying."
  exit 1
fi

echo ""
echo "  All checks passed."

# ── Build & Deploy ────────────────────────────────────────────────────────────
echo ""
echo "▶ Building Docker images..."
docker compose -f "$COMPOSE_FILE" --env-file .env.production build

echo ""
echo "▶ Starting all services..."
docker compose -f "$COMPOSE_FILE" --env-file .env.production up -d

# ── Post-deploy health check ──────────────────────────────────────────────────
echo ""
echo "▶ Waiting for services to be ready..."
sleep 10

# Health check hits the container locally on the EC2 box (avoids depending on
# DNS having flipped yet during the cutover window).
HEALTH=$(curl -s --max-time 10 "http://localhost:8000/health" 2>/dev/null || echo "FAILED")
if echo "$HEALTH" | grep -q "healthy"; then
  echo "  ✅ Backend health check passed"
else
  echo "  ❌ Backend health check failed — check logs:"
  echo "     docker logs molarplus-backend-1 --tail 30"
  exit 1
fi

# ── Seed the feature-request board (idempotent) ───────────────────────────────
echo ""
echo "▶ Seeding feature-request board (idempotent)..."
docker exec molarplus-backend-1 python scripts/seed_feature_requests.py || echo "  ⚠️  seed step skipped/failed (non-fatal)"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Service status:"
docker compose -f "$COMPOSE_FILE" --env-file .env.production ps
