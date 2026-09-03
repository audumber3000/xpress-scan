#!/bin/bash
set -e

echo "======================================"
echo "  MolarPlus Backend — Deploy Script"
echo "======================================"

# ── Pre-deploy checks ─────────────────────────────────────────────────────────
echo ""
echo "▶ Running pre-deploy checks..."

ERRORS=0

# 1. .env.production must exist
if [ ! -f .env.production ]; then
  echo "  ❌ .env.production not found — run: cp .env.production.example .env.production"
  ERRORS=$((ERRORS+1))
else
  echo "  ✅ .env.production found"

  # 2. Required vars must be set and non-empty
  REQUIRED_VARS="DATABASE_URL JWT_SECRET FIREBASE_JSON_PATH R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY CASHFREE_APP_ID CASHFREE_SECRET_KEY BACKEND_URL"
  for VAR in $REQUIRED_VARS; do
    VALUE=$(grep -E "^${VAR}=" .env.production | cut -d'=' -f2-)
    PLACEHOLDER="your_$(printf '%s' "$VAR" | tr '[:upper:]' '[:lower:]')_here"
    if [ -z "$VALUE" ] || [ "$VALUE" = "$PLACEHOLDER" ]; then
      echo "  ❌ $VAR is not set in .env.production"
      ERRORS=$((ERRORS+1))
    else
      echo "  ✅ $VAR is set"
    fi
  done

  # 3. DATABASE_URL must NOT contain a bare @ in the password (must use %40)
  DB_URL=$(grep -E "^DATABASE_URL=" .env.production | cut -d'=' -f2-)
  STRIPPED="${DB_URL#postgresql://}"
  CREDENTIALS="${STRIPPED%%@*}"
  PASSWORD="${CREDENTIALS##*:}"
  if echo "$PASSWORD" | grep -q '@'; then
    echo "  ❌ DATABASE_URL password contains a bare '@' — encode it as '%40'"
    echo "     e.g.  postgresql://user:Pass%40word@db:5432/dbname"
    ERRORS=$((ERRORS+1))
  else
    echo "  ✅ DATABASE_URL password encoding looks correct"
  fi

  # 4. Firebase JSON file must exist on this machine (for rsync/scp)
  FIREBASE_PATH=$(grep -E "^FIREBASE_JSON_PATH=" .env.production | cut -d'=' -f2-)
  if [ -f "$FIREBASE_PATH" ]; then
    echo "  ✅ Firebase JSON found at $FIREBASE_PATH"
  else
    echo "  ⚠️  Firebase JSON not found at $FIREBASE_PATH (ensure it exists on the server)"
  fi
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS pre-deploy check(s) failed. Fix the issues above before deploying."
  exit 1
fi

# 5. Auto-run DB migrations before schema check
#    Runs each ALTER via `docker exec molarplus-db-1 psql ...` so it works
#    regardless of whether the host can resolve the docker-internal `db` hostname
#    in DATABASE_URL. Fails loud if the container isn't running.
echo ""
echo "▶ Running DB migrations against prod DB..."

if ! docker ps --format '{{.Names}}' | grep -q '^molarplus-db-1$'; then
  echo "  ❌ molarplus-db-1 container is not running — cannot apply migrations"
  exit 1
fi

run_migration() {
  local label="$1"
  local ddl="$2"
  if docker exec molarplus-db-1 psql -U postgres -d molarplus -v ON_ERROR_STOP=1 -c "$ddl" >/dev/null 2>&1; then
    echo "  ✅ $label"
  else
    echo "  ❌ $label — failed:"
    docker exec molarplus-db-1 psql -U postgres -d molarplus -c "$ddl" 2>&1 | sed 's/^/     /'
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
run_migration "case_paper_type" "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS case_paper_type VARCHAR(16) DEFAULT 'dental'"
run_migration "derm_findings" "ALTER TABLE case_papers ADD COLUMN IF NOT EXISTS derm_findings JSON"
run_migration "email_report_unsubscribed" "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_report_unsubscribed BOOLEAN DEFAULT FALSE"
run_migration "trial_used"        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE"

# Help Center — feature-request board
run_migration "feature_requests" "CREATE TABLE IF NOT EXISTS feature_requests (id SERIAL PRIMARY KEY, created_by INTEGER REFERENCES users(id), clinic_id INTEGER REFERENCES clinics(id), title VARCHAR NOT NULL, description TEXT, status VARCHAR DEFAULT 'open', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())"
run_migration "feature_request_votes" "CREATE TABLE IF NOT EXISTS feature_request_votes (id SERIAL PRIMARY KEY, feature_request_id INTEGER NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW(), CONSTRAINT uq_feature_vote UNIQUE (feature_request_id, user_id))"

# WA Reach — own-number WhatsApp (Pro). Additive; MSG91 path untouched.
run_migration "notif_provider"   "ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS provider VARCHAR DEFAULT 'msg91'"
run_migration "patient_dob"       "ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth DATE"
run_migration "whatsapp_integrations" "CREATE TABLE IF NOT EXISTS whatsapp_integrations (id SERIAL PRIMARY KEY, clinic_id INTEGER NOT NULL UNIQUE REFERENCES clinics(id), provider VARCHAR DEFAULT 'wareach', session_id VARCHAR, api_key_enc TEXT, phone_number VARCHAR, status VARCHAR DEFAULT 'disconnected', last_status_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())"
run_migration "lab_order_invoice_line" "ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS invoice_line_item_id INTEGER REFERENCES invoice_line_items(id)"

# Patient registration date — back-dateable, clinic-local, and what decides
# new-vs-repeat in the daily register. Backfilled from created_at so existing
# patients are never blank.
run_migration "patient_registered_on" "ALTER TABLE patients ADD COLUMN IF NOT EXISTS registered_on DATE"
run_migration "patient_registered_on_backfill" "UPDATE patients SET registered_on = created_at::date WHERE registered_on IS NULL"

# Standing allergies on the patient. Case papers already carry a per-visit
# allergies list; this is the fact about the person that the patient file's
# safety banner reads. No backfill: an empty allergy field means "not asked",
# and guessing one from historical case papers would be inventing a clinical
# record.
run_migration "patient_allergies" "ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies TEXT"

# Invoice drawer rebuild.
#
# tooth_number: which tooth a billed line is for. Both PDF templates already read
# this field and have been printing an empty column on every invoice.
run_migration "treatment_benefit_category" "ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS benefit_category VARCHAR(16)"

run_migration "patient_case_paper_type" "ALTER TABLE patients ADD COLUMN IF NOT EXISTS case_paper_type VARCHAR(16)"

run_migration "line_item_tooth" "ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS tooth_number VARCHAR"

# reference / recorded_by: the transaction a part payment arrived on, and who
# took it. invoices.utr holds one reference for the whole bill, which cannot
# describe a bill settled over three instalments on three different rails.
run_migration "payment_reference" "ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS reference VARCHAR"
run_migration "payment_recorded_by" "ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS recorded_by INTEGER REFERENCES users(id)"

# Imaging and documents, rebuilt as real tabs.
#
# tooth_area: which tooth or region a film covers. Free text — an OPG covers
# every tooth and a bitewing covers a pair, so a numeric column would be wrong
# for most of them.
run_migration "xray_tooth_area" "ALTER TABLE xray_images ADD COLUMN IF NOT EXISTS tooth_area VARCHAR"

# category: what an uploaded file is. Consents, prescriptions, invoices and
# reports live in their own tables and need no column; this is for hand uploads.
run_migration "document_category" "ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS category VARCHAR"

# Image types move to the words clinics actually use. Done as data rather than
# a display-time map so the database, the screen and any export agree on one
# name. Idempotent: re-running matches nothing the second time.
run_migration "xray_type_iopa" "UPDATE xray_images SET image_type = 'IOPA' WHERE lower(image_type) IN ('periapical', 'iopa')"
run_migration "xray_type_opg"  "UPDATE xray_images SET image_type = 'OPG' WHERE lower(image_type) IN ('panoramic', 'opg')"
run_migration "xray_type_bitewing" "UPDATE xray_images SET image_type = 'Bitewing' WHERE lower(image_type) = 'bitewing'"

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
# Patient form messages are opt-in per clinic and default OFF: the Meta template
# has to be approved and the wallet has a cost per send, so nobody should be
# billed for a message they did not switch on. Without a row at all notify_event
# returns silently, which is why the route reports "not configured" rather than
# claiming a send.
run_migration "quotation_sent_pref" "INSERT INTO notification_preferences (clinic_id, event_type, channels, is_enabled) SELECT c.id, 'quotation_sent', '[\"whatsapp\"]'::json, FALSE FROM clinics c WHERE NOT EXISTS (SELECT 1 FROM notification_preferences p WHERE p.clinic_id = c.id AND p.event_type = 'quotation_sent')"

run_migration "patient_form_pref" "INSERT INTO notification_preferences (clinic_id, event_type, channels, is_enabled) SELECT c.id, 'patient_form', '[\"whatsapp\"]'::json, FALSE FROM clinics c WHERE NOT EXISTS (SELECT 1 FROM notification_preferences p WHERE p.clinic_id = c.id AND p.event_type = 'patient_form')"

run_migration "receipt_notification_pref" "INSERT INTO notification_preferences (clinic_id, event_type, channels, is_enabled) SELECT c.id, 'receipt_notification', '[\"whatsapp\"]'::json, TRUE FROM clinics c WHERE NOT EXISTS (SELECT 1 FROM notification_preferences p WHERE p.clinic_id = c.id AND p.event_type = 'receipt_notification')"
# mp_lab_order_placed is approved in Meta now, so lab orders are no longer
# email-only. Existing rows stay disabled; this only widens the channel list.
run_migration "lab_order_whatsapp" "UPDATE notification_preferences SET channels = '[\"whatsapp\", \"email\"]'::json WHERE event_type = 'lab_order_placed' AND channels::text = '[\"email\"]'"

# Master password — the six digits asked for before a delete nothing can undo
# (a patient, a paid bill, a receipted payment). Deliberately NOT backfilled:
# a NULL hash means "still on the factory default 123456", which is what the
# nudge in Control Center → Verification keys off. Every existing clinic keeps
# working on day one and gets told to pick its own.
run_migration "clinic_master_password"        "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS master_password_hash VARCHAR"
run_migration "clinic_master_password_at"     "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS master_password_updated_at TIMESTAMP"
run_migration "clinic_master_password_tries"  "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS master_password_attempts INTEGER DEFAULT 0"
run_migration "clinic_master_password_lock"   "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS master_password_locked_until TIMESTAMP"
# What an OTP is good for. Existing rows are all contact verifications; the
# column separates those from the codes that authorise a master password change,
# so a send for one no longer invalidates an outstanding code for the other.
run_migration "otp_purpose"                   "ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS purpose VARCHAR NOT NULL DEFAULT 'contact_verification'"

# Mobile version gate. One row per platform, edited in place: raising the floor
# is a psql UPDATE that takes effect on every app's next launch, with no backend
# deploy and no store release. Seeded deliberately LOW so that shipping this
# does not force-update anybody on day one.
run_migration "app_versions" "CREATE TABLE IF NOT EXISTS app_versions (id SERIAL PRIMARY KEY, platform VARCHAR NOT NULL UNIQUE, min_supported VARCHAR NOT NULL DEFAULT '0.0.0', latest VARCHAR NOT NULL DEFAULT '0.0.0', message VARCHAR, store_url VARCHAR, updated_at TIMESTAMP DEFAULT NOW())"
run_migration "app_versions_seed" "INSERT INTO app_versions (platform, min_supported, latest) VALUES ('ios', '3.15.0', '3.17.0'), ('android', '3.15.0', '3.17.0') ON CONFLICT (platform) DO NOTHING"

# Location capture. The attendance geofence has existed in
# domains/scheduling/routes/attendance_mobile.py since it was written, reading
# clinic.latitude and writing attendance.clock_in_* — none of which existed, so
# every call to /attendance-mobile/clock-in returned a 500 with an empty body.
# These columns are what make that endpoint work for the first time.
run_migration "clinic_geo_lat"     "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION"
run_migration "clinic_geo_lng"     "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION"
run_migration "clinic_geo_radius"  "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS geofence_radius_m INTEGER DEFAULT 150"
run_migration "att_in_lat"    "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_latitude DOUBLE PRECISION"
run_migration "att_in_lng"    "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_longitude DOUBLE PRECISION"
run_migration "att_in_acc"    "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_accuracy DOUBLE PRECISION"
run_migration "att_in_addr"   "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_address VARCHAR"
run_migration "att_in_dist"   "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_distance_m DOUBLE PRECISION"
run_migration "att_out_lat"   "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_latitude DOUBLE PRECISION"
run_migration "att_out_lng"   "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_longitude DOUBLE PRECISION"
run_migration "att_out_acc"   "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_accuracy DOUBLE PRECISION"
run_migration "att_out_addr"  "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_address VARCHAR"
run_migration "att_out_dist"  "ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_distance_m DOUBLE PRECISION"
# A precise fix beside the coarse IP guess already in user_devices.location.
run_migration "device_geo_lat" "ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION"
run_migration "device_geo_lng" "ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION"
run_migration "device_geo_acc" "ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS location_accuracy DOUBLE PRECISION"

# Optional staff detail, filled in from the person's own profile rather than
# asked for while adding them. salary_day is the day of the month pay is handed
# over, which is what lets Payables say what is owed without anybody keeping a
# mental calendar. All nullable: "no salary recorded" is a real answer and is
# not the same as zero.
run_migration "user_salary_amount" "ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_amount DOUBLE PRECISION"
run_migration "user_salary_day"    "ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_day INTEGER"
run_migration "user_joined_on"     "ALTER TABLE users ADD COLUMN IF NOT EXISTS joined_on DATE"

# The tax inside a subscription payment, so a GST invoice can itemise it rather
# than printing one opaque total. Nullable: payments taken before this column
# existed have an unknown split and are shown without a tax line.
run_migration "subpay_tax_amount" "ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS tax_amount DOUBLE PRECISION"

# Which promo code produced a payment, and what it took off. Nullable: every
# payment taken before promo attribution existed has neither.
run_migration "subpay_coupon_code"     "ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS coupon_code VARCHAR"
run_migration "subpay_discount_amount" "ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION"

# The one promo, if any, shown as a banner on every clinic's Subscription page.
# Defaults FALSE so shipping this feature does not start advertising an old code.
run_migration "coupon_is_featured"    "ALTER TABLE subscription_coupons ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE"

# ── One-shot data migrations ────────────────────────────────────────────────
# Everything above is idempotent DDL that can safely run on every deploy. The
# two below CHANGE DATA, and re-running them would undo decisions clinics made
# after the first run: an owner who switched the daily summary back on would
# find it off again the next time we deployed. So they are gated on a marker
# row and run exactly once.
run_migration "data_migration_ledger" "CREATE TABLE IF NOT EXISTS applied_data_migrations (key VARCHAR PRIMARY KEY, applied_at TIMESTAMP DEFAULT NOW())"

# Daily summary becomes opt-in. It is a WhatsApp message to every clinic owner
# every evening, on our tab rather than theirs, and almost nobody asked for it.
# daily_summary_broadcast_job now skips any clinic whose row is off or missing,
# so this switch-off is what stops the spend for the clinics already on it.
run_migration "daily_summary_optin" "DO \$do\$ BEGIN IF NOT EXISTS (SELECT 1 FROM applied_data_migrations WHERE key = 'daily_summary_optin_v1') THEN UPDATE notification_preferences SET is_enabled = FALSE WHERE event_type = 'daily_summary'; INSERT INTO applied_data_migrations (key) VALUES ('daily_summary_optin_v1'); END IF; END \$do\$;"

# Welcome credit drops from 50 to 10 (core/wallet_service.WELCOME_CREDIT).
# Existing wallets are pulled back to the new figure, but ONLY the ones still
# sitting on free money: `last_topup_at IS NULL` excludes every clinic that has
# ever paid us, and `balance > 10` means this can only ever take back credit we
# gave away, never credit somebody bought, and never top anybody up.
run_migration "wallet_welcome_credit_10" "DO \$do\$ BEGIN IF NOT EXISTS (SELECT 1 FROM applied_data_migrations WHERE key = 'wallet_welcome_credit_10_v1') THEN UPDATE notification_wallets SET balance = 10 WHERE last_topup_at IS NULL AND balance > 10; INSERT INTO applied_data_migrations (key) VALUES ('wallet_welcome_credit_10_v1'); END IF; END \$do\$;"

# The 2-hour appointment reminder. notify_event sends nothing when a clinic has
# no preference row for an event, and rows are seeded lazily (only when somebody
# opens Notifications -> Preferences). Without this backfill the second reminder
# would quietly never fire for any existing clinic.
#
# Seeded OFF: a second reminder per appointment roughly doubles this line of a
# clinic's WhatsApp spend, and that is their money to commit. The row is created
# anyway so the switch exists on Notifications -> Preferences to be turned on.
# Channels are copied so a clinic running on email only stays that way.
run_migration "appointment_reminder_2h_prefs" "DO \$do\$ BEGIN IF NOT EXISTS (SELECT 1 FROM applied_data_migrations WHERE key = 'appointment_reminder_2h_prefs_v1') THEN INSERT INTO notification_preferences (clinic_id, event_type, channels, is_enabled) SELECT p.clinic_id, 'appointment_reminder_2h', p.channels, false FROM notification_preferences p WHERE p.event_type = 'appointment_reminder' AND NOT EXISTS (SELECT 1 FROM notification_preferences q WHERE q.clinic_id = p.clinic_id AND q.event_type = 'appointment_reminder_2h'); INSERT INTO applied_data_migrations (key) VALUES ('appointment_reminder_2h_prefs_v1'); END IF; END \$do\$;"

# 6. Schema migration check — catch missing ALTER TABLE migrations before deploy
echo ""
echo "▶ Running schema migration check against prod DB..."

SCHEMA_OK=true
while IFS='|' read -r table required_cols; do
  [ -z "$table" ] && continue
  ACTUAL=$(docker exec molarplus-db-1 psql -U postgres -d molarplus -tA -c \
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='$table'" 2>/dev/null)
  if [ -z "$ACTUAL" ]; then
    echo "  ❌ Schema check could not query table '$table' — DB unreachable"
    exit 1
  fi
  for col in $required_cols; do
    if ! echo "$ACTUAL" | grep -qx "$col"; then
      echo "  ❌ $table is missing column: $col"
      SCHEMA_OK=false
    fi
  done
done <<'REQUIRED_COLUMNS'
clinics|id clinic_code name address phone email gst_number specialization subscription_plan status razorpay_customer_id cashfree_customer_id logo_url invoice_template primary_color number_of_chairs timings created_at updated_at synced_at sync_status referred_by_code clinic_label parent_clinic_id country currency_code currency_symbol timezone tax_label tax_id master_password_hash master_password_updated_at master_password_attempts master_password_locked_until case_paper_type
users|id email name first_name last_name role is_active permissions created_at updated_at email_report_unsubscribed
user_clinics|user_id clinic_id role is_active created_at
patients|id clinic_id name phone date_of_birth registered_on allergies created_at updated_at
xray_images|id clinic_id patient_id file_path image_type tooth_area created_at
patient_documents|id clinic_id patient_id file_name file_path category created_at
invoice_line_items|id invoice_id description tooth_number quantity unit_price amount
invoice_payments|id invoice_id amount paid_on method reference recorded_by
appointments|id clinic_id patient_name appointment_date start_time end_time status created_at updated_at
subscriptions|id plan_name status current_start current_end is_trial trial_ends_at
REQUIRED_COLUMNS

if [ "$SCHEMA_OK" = true ]; then
  echo "  ✅ Schema check passed — all required columns exist"
else
  echo ""
  echo "  Run the missing ALTER TABLE migrations on prod before deploying."
  echo "  Example: docker exec molarplus-db-1 psql -U postgres molarplus -c \\"
  echo "    \"ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type>;\""
  exit 1
fi

echo ""
echo "  All checks passed."

# ── Build & Deploy ────────────────────────────────────────────────────────────
echo ""
echo "▶ Building Docker images..."
docker compose -f docker-compose.prod.yml --env-file .env.production build

echo ""
echo "▶ Starting all services..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# ── Post-deploy health check ──────────────────────────────────────────────────
echo ""
echo "▶ Waiting for services to be ready..."
sleep 10

BACKEND_URL=$(grep -E "^BACKEND_URL=" .env.production | cut -d'=' -f2-)
HEALTH=$(curl -s --max-time 10 "${BACKEND_URL}/health" 2>/dev/null || echo "FAILED")
if echo "$HEALTH" | grep -q "healthy"; then
  echo "  ✅ Backend health check passed"
else
  echo "  ❌ Backend health check failed — check logs:"
  echo "     docker logs molarplus-backend-1 --tail 30"
  exit 1
fi

# ── Seed the feature-request board (run-once; skips if it already has rows) ────
echo ""
echo "▶ Seeding feature-request board (idempotent)..."
docker exec molarplus-backend-1 python scripts/seed_feature_requests.py || echo "  ⚠️  seed step skipped/failed (non-fatal)"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Service status:"
docker compose -f docker-compose.prod.yml --env-file .env.production ps
echo ""
echo "Tail logs with:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production logs -f"
