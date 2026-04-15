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

# 5. Schema migration check — catch missing ALTER TABLE migrations before deploy
echo ""
echo "▶ Running schema migration check against prod DB..."
DB_URL=$(grep -E "^DATABASE_URL=" .env.production | cut -d'=' -f2-)

SCHEMA_RESULT=$(python3 - <<PYEOF
import sys
try:
    from sqlalchemy import create_engine, text
    engine = create_engine("$DB_URL")
    REQUIRED = {
        "clinics": {
            "id", "clinic_code", "name", "address", "phone", "email",
            "gst_number", "specialization", "subscription_plan", "status",
            "razorpay_customer_id", "cashfree_customer_id",
            "logo_url", "invoice_template", "primary_color",
            "number_of_chairs", "timings",
            "created_at", "updated_at", "synced_at", "sync_status",
            "referred_by_code",
        },
        "users": {
            "id", "email", "name", "first_name", "last_name",
            "role", "is_active", "permissions", "created_at", "updated_at",
        },
        "user_clinics": {"id", "user_id", "clinic_id"},
        "patients": {"id", "clinic_id", "name", "phone", "created_at", "updated_at"},
        "appointments": {
            "id", "clinic_id", "patient_name",
            "appointment_date", "start_time", "end_time",
            "status", "created_at", "updated_at",
        },
    }
    failures = []
    with engine.connect() as conn:
        for table, required in REQUIRED.items():
            rows = conn.execute(
                text("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=:t"),
                {"t": table}
            )
            actual = {r[0] for r in rows}
            missing = required - actual
            if missing:
                failures.append(f"  {table}: missing {sorted(missing)}")
    engine.dispose()
    if failures:
        print("FAIL")
        for f in failures:
            print(f)
    else:
        print("OK")
except Exception as e:
    print(f"ERROR: {e}")
PYEOF
)

if echo "$SCHEMA_RESULT" | grep -q "^OK"; then
  echo "  ✅ Schema check passed — all required columns exist"
elif echo "$SCHEMA_RESULT" | grep -q "^ERROR"; then
  echo "  ⚠️  Could not connect to DB for schema check — proceeding anyway"
  echo "     $SCHEMA_RESULT"
else
  echo "  ❌ Schema check FAILED — missing columns detected:"
  echo "$SCHEMA_RESULT" | grep -v "^FAIL"
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
