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
