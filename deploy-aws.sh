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

# ── Schema migration check (run against RDS) ──────────────────────────────────
echo ""
echo "▶ Running schema migration check against RDS..."

declare -A REQUIRED_COLS=(
  ["clinics"]="id clinic_code name address phone email gst_number specialization subscription_plan status razorpay_customer_id cashfree_customer_id logo_url invoice_template primary_color number_of_chairs timings created_at updated_at synced_at sync_status referred_by_code clinic_label parent_clinic_id country currency_code currency_symbol timezone tax_label tax_id license_number license_authority license_expiry account_manager_name account_manager_role account_manager_email account_manager_phone"
  ["users"]="id email name first_name last_name role is_active permissions created_at updated_at email_report_unsubscribed"
  ["user_clinics"]="user_id clinic_id role is_active created_at"
  ["patients"]="id clinic_id name phone date_of_birth created_at updated_at"
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
