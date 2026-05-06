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
    if [ -z "$VALUE" ] || [ "$VALUE" = "your_${VAR,,}_here" ]; then
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

# 6. Schema migration check — catch missing ALTER TABLE migrations before deploy
echo ""
echo "▶ Running schema migration check against prod DB..."

declare -A REQUIRED_COLS=(
  ["clinics"]="id clinic_code name address phone email gst_number specialization subscription_plan status razorpay_customer_id cashfree_customer_id logo_url invoice_template primary_color number_of_chairs timings created_at updated_at synced_at sync_status referred_by_code clinic_label parent_clinic_id country currency_code currency_symbol timezone tax_label tax_id"
  ["users"]="id email name first_name last_name role is_active permissions created_at updated_at"
  ["user_clinics"]="user_id clinic_id role is_active created_at"
  ["patients"]="id clinic_id name phone created_at updated_at"
  ["appointments"]="id clinic_id patient_name appointment_date start_time end_time status created_at updated_at"
  ["subscriptions"]="id plan_name status current_start current_end is_trial trial_ends_at"
)

SCHEMA_OK=true
for table in "${!REQUIRED_COLS[@]}"; do
  ACTUAL=$(docker exec molarplus-db-1 psql -U postgres -d molarplus -tA -c \
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

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Service status:"
docker compose -f docker-compose.prod.yml --env-file .env.production ps
echo ""
echo "Tail logs with:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.production logs -f"
