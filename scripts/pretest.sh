#!/usr/bin/env bash
#
# Run everything CI runs, on this Mac, before a manual AWS deploy.
# No EC2, no staging box, no cost: the only infrastructure is a throwaway
# Postgres container that is destroyed on exit.
#
#   ./scripts/pretest.sh          fast suites (backend + nexus), ~2 min
#   ./scripts/pretest.sh --full   also boots the real Docker stack, ~8 min
#
# --full is the one that catches the class of bug that caused the WhatsApp
# invoice outage: code that reads an env var which was never wired through
# docker-compose. Unit tests mock the outside world and structurally cannot
# see it; only booting the real images with the real compose file can.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PG_CONTAINER=molarplus-pretest-db
PG_PORT=5436          # 5432 is usually a native Postgres on a dev Mac
FULL=0
[ "${1:-}" = "--full" ] && FULL=1

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }

cleanup() { docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

command -v docker >/dev/null || { red "docker not found"; exit 1; }
docker info >/dev/null 2>&1 || { red "Docker is not running — start Docker Desktop"; exit 1; }

step "Starting throwaway Postgres on :$PG_PORT"
cleanup
docker run -d --name "$PG_CONTAINER" \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=xpress_scan_test \
  -p "$PG_PORT:5432" postgres:16 >/dev/null
for i in $(seq 1 30); do
  docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  [ "$i" = 30 ] && { red "Postgres never became ready"; exit 1; }
  sleep 1
done
green "  Postgres ready"

step "Backend tests"
( cd backend && \
  USE_LOCAL_DB=true LOCAL_DB_HOST=localhost LOCAL_DB_PORT="$PG_PORT" \
  LOCAL_DB_NAME=xpress_scan_test LOCAL_DB_USER=postgres LOCAL_DB_PASSWORD=postgres \
  JWT_SECRET=test-jwt-secret-for-testing-only \
  ./venv/bin/python -m pytest tests/domains tests/test_integration_contract.py tests/test_platform_outreach.py -q -c config/pytest.ini --no-cov )

step "Nexus-service tests"
( cd nexus-service && ./venv/bin/python -m pytest tests -q --no-cov )

if [ "$FULL" = 1 ]; then
  step "Booting the real Docker stack (same images as prod)"
  ENV_FILE=$(mktemp)
  FIREBASE_JSON=$(mktemp).json
  cat > "$FIREBASE_JSON" <<'JSON'
{"type":"service_account","project_id":"pretest-dummy","private_key":"-----BEGIN PRIVATE KEY-----\nZHVtbXk=\n-----END PRIVATE KEY-----\n","client_email":"pretest@pretest-dummy.iam.gserviceaccount.com"}
JSON
  # Dummy values throughout. preflight.py only checks these are present and
  # well-formed, never that they are real, so nothing here touches a live
  # third party or a real clinic's data.
  cat > "$ENV_FILE" <<EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=molarplus_pretest
JWT_SECRET=pretest-only-secret-not-used-anywhere-real-32chars
INTERNAL_API_KEY=pretest-internal-key
WAREACH_WEBHOOK_SECRET=pretest-wareach-secret
FIREBASE_JSON_PATH=$FIREBASE_JSON
DATABASE_URL=postgresql://postgres:postgres@db:5432/molarplus_pretest
R2_ACCESS_KEY_ID=pretest-dummy
R2_SECRET_ACCESS_KEY=pretest-dummy
R2_ENDPOINT_URL=https://pretest-dummy.r2.cloudflarestorage.com
R2_BUCKET_NAME=pretest-dummy
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
MAIN_BACKEND_URL=http://backend:8000
CASHFREE_APP_ID=pretest-dummy
CASHFREE_SECRET_KEY=pretest-dummy
CASHFREE_ENV=sandbox
SUBSCRIPTION_PROVIDER=cashfree
CASHFREE_RETURN_URL=http://localhost:8000/subscription
CASHFREE_NOTIFY_URL=http://localhost:8000/api/v1/subscriptions/webhook/cashfree
OPENAI_API_KEY=
GOOGLE_PLACES_API_KEY=
META_ACCESS_TOKEN=pretest-dummy
META_PHONE_NUMBER_ID=pretest-dummy
META_WHATSAPP_BUSINESS_ACCOUNT_ID=pretest-dummy
META_API_VERSION=v19.0
ZEPTO_MAIL_TOKEN=pretest-dummy
ZEPTO_API_URL=https://api.zeptomail.in/v1.1/email
ZEPTO_PLATFORM_FROM_EMAIL=clinic@example.test
ZEPTO_PLATFORM_FROM_NAME=Pretest
ZEPTO_PATIENT_FROM_EMAIL=care@example.test
ZEPTO_PATIENT_FROM_NAME="Pretest Care"
ZEPTO_FROM_EMAIL=clinic@example.test
ZEPTO_FROM_NAME=Pretest
WA_TPL_APPOINTMENT_BOOKED=mp_appointment_booked
WA_TPL_APPOINTMENT_CONFIRMED=mp_appointment_confirmed
WA_TPL_CHECKED_IN=mp_checked_in
WA_TPL_APPOINTMENT_REMINDER=mp_appointment_reminder
WA_TPL_INVOICE=mp_invoice_sent
WA_TPL_PRESCRIPTION=mp_prescription_sent
WA_TPL_CONSENT_FORM=mp_consent_form
WA_TPL_GOOGLE_REVIEW=mp_google_review
MSG91_AUTH_KEY=pretest-dummy
MSG91_SMS_SENDER=PRETEST
EOF

  # ⚠️ --env-file does NOT win over an exported shell variable: compose
  # interpolation takes the shell environment FIRST and only then the env
  # file. This machine exports POSTGRES_DB=postgres (project .env leaks into
  # the shell), so `POSTGRES_DB: ${POSTGRES_DB}` resolved to `postgres` while
  # DATABASE_URL still said molarplus_pretest — the stack booted a database
  # by the wrong name and every query died with "does not exist". Sourcing
  # the file into the environment makes the two agree, whatever the shell
  # already had.
  set -a; . "$ENV_FILE"; set +a

  # The stack's own db publishes a host port so the smoke tests (which run on
  # this machine, not in a container) can inspect the real schema. 5432 is
  # normally a native Postgres on a dev Mac, so move it; CI leaves it at the
  # 5432 default.
  export CI_DB_HOST_PORT=55433

  # -p isolates this run's containers, network and volumes from any other
  # compose stack built from this repo, so a stale postgres_data volume can
  # never leak a previous run's database into this one.
  DC="docker compose -p molarplus-pretest -f docker-compose.prod.yml -f docker-compose.ci.yml --env-file $ENV_FILE"
  stack_down() { $DC down -v >/dev/null 2>&1 || true; rm -f "$ENV_FILE" "$FIREBASE_JSON"; cleanup; }
  trap stack_down EXIT

  $DC build backend nexus
  $DC up -d --wait db redis
  $DC run --rm backend python -c \
    "from database import engine; from models import Base; Base.metadata.create_all(bind=engine); print('schema created')"
  $DC up -d backend nexus

  for svc in "backend:8000" "nexus:8001"; do
    name="${svc%%:*}"; port="${svc##*:}"
    printf '  waiting for %s on :%s' "$name" "$port"
    for i in $(seq 1 45); do
      if curl -sf "http://localhost:$port/health" >/dev/null 2>&1; then printf ' up\n'; break; fi
      [ "$i" = 45 ] && { printf '\n'; red "$name never became healthy"; $DC logs "$name" --tail 100; exit 1; }
      printf '.'; sleep 2
    done
  done

  step "Smoke tests against the real stack"
  SMOKE_URL=http://localhost:8000 \
  NEXUS_SMOKE_URL=http://localhost:8001 \
  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:$CI_DB_HOST_PORT/molarplus_pretest \
  # --confcutdir stops pytest loading backend/tests/conftest.py, which imports
  # the whole app (`from models import Base`) and needs backend/ on sys.path
  # plus every app dependency. The smoke tests deliberately need none of that:
  # they talk to the running stack over HTTP and define their own fixtures.
  backend/venv/bin/python -m pytest \
    backend/tests/smoke/test_smoke.py backend/tests/smoke/test_ephemeral_stack_smoke.py \
    --confcutdir=backend/tests/smoke \
    --deselect backend/tests/smoke/test_smoke.py::test_nexus_reachable_through_nginx_consent_routing \
    -q
fi

green "
All green. Safe to deploy."
