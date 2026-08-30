"""
Pre-flight checks — runs before uvicorn starts.
If any check fails the container exits immediately with a clear error.
"""

import os
import sys
import json

PASS = "\033[92m✅\033[0m"
FAIL = "\033[91m❌\033[0m"
WARN = "\033[93m⚠️ \033[0m"

errors = []

def ok(msg):  print(f"  {PASS} {msg}")
def fail(msg): errors.append(msg); print(f"  {FAIL} {msg}")
def warn(msg): print(f"  {WARN} {msg}")


print("\n========================================")
print("  MolarPlus — Pre-flight Checks")
print("========================================\n")


# ── 1. Required environment variables ────────────────────────────────────────
print("[ 1 ] Environment variables")
REQUIRED = [
    "DATABASE_URL",
    "JWT_SECRET",
    "FIREBASE_SERVICE_ACCOUNT_PATH",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT_URL",
    "R2_BUCKET_NAME",
    "CASHFREE_APP_ID",
    "CASHFREE_SECRET_KEY",
    "BACKEND_URL",
    "REDIS_URL",
]
for var in REQUIRED:
    val = os.environ.get(var, "")
    if not val:
        fail(f"{var} is not set")
    else:
        ok(var)


# ── 1b. JWT_SECRET — identity, and whether it survived the last migration ────
print("\n[ 1b ] Signing secret")
_jwt = os.environ.get("JWT_SECRET", "")
if _jwt:
    if _jwt == "your-secret-key":
        fail("JWT_SECRET is still the development placeholder. Every session token "
             "this container issues could be forged by anyone who has read the source.")
    elif len(_jwt) < 32:
        warn(f"JWT_SECRET is only {len(_jwt)} characters. 32 or more is the sensible floor.")

    # A short, non-reversible tag for the secret. Changing JWT_SECRET
    # invalidates every token already in circulation at the instant of the
    # change, which customers experience as being signed out at random and
    # which is indistinguishable from a bug in the app. Run preflight on the old
    # host and the new one and compare these eight characters: same tag means
    # sessions carried over, different means they were all killed at cutover.
    import hashlib as _h
    print(f"      secret fingerprint: {_h.sha256(_jwt.encode()).hexdigest()[:8]}"
          "  (compare across hosts; it is not the secret)")


# ── 2. DATABASE_URL — no bare @ in password ───────────────────────────────────
print("\n[ 2 ] DATABASE_URL format")
db_url = os.environ.get("DATABASE_URL", "")
if db_url:
    stripped = db_url.replace("postgresql://", "").replace("postgres://", "")
    credentials = stripped.split("@")[0]
    password = credentials.split(":")[-1] if ":" in credentials else ""
    if "@" in password:
        fail("DATABASE_URL password contains a bare '@' — encode it as '%40'")
    else:
        ok("DATABASE_URL password encoding is correct")


# ── 3. Database connectivity + key tables ─────────────────────────────────────
print("\n[ 3 ] Database connectivity")
try:
    import psycopg2
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    ok("Connected to PostgreSQL")

    REQUIRED_TABLES = ["users", "clinics", "patients", "appointments", "invoices"]
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
    """)
    existing = {row[0] for row in cur.fetchall()}
    for table in REQUIRED_TABLES:
        if table in existing:
            ok(f"Table '{table}' exists")
        else:
            fail(f"Table '{table}' is MISSING — run init_local_db.py")

    cur.close()
    conn.close()
except Exception as e:
    fail(f"Database connection failed: {e}")


# ── 4. Redis connectivity ─────────────────────────────────────────────────────
print("\n[ 4 ] Redis connectivity")
try:
    import redis as redis_lib
    redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    r = redis_lib.from_url(redis_url, socket_connect_timeout=5)
    r.ping()
    ok(f"Connected to Redis at {redis_url}")
except Exception as e:
    fail(f"Redis connection failed: {e}")


# ── 5. Firebase JSON ──────────────────────────────────────────────────────────
print("\n[ 5 ] Firebase credentials")
firebase_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "")
if firebase_path:
    if not os.path.exists(firebase_path):
        fail(f"Firebase JSON not found at {firebase_path}")
    else:
        try:
            with open(firebase_path) as f:
                data = json.load(f)
            if "project_id" in data and "private_key" in data:
                ok(f"Firebase JSON valid (project: {data.get('project_id')})")
            else:
                fail("Firebase JSON is missing required fields (project_id / private_key)")
        except json.JSONDecodeError:
            fail(f"Firebase JSON at {firebase_path} is not valid JSON")


# ── 6. R2 / Storage ───────────────────────────────────────────────────────────
print("\n[ 6 ] Cloudflare R2 config")
r2_vars = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT_URL", "R2_BUCKET_NAME"]
r2_ok = all(os.environ.get(v) for v in r2_vars)
if r2_ok:
    ok("All R2 credentials are set")
else:
    fail("One or more R2 credentials are missing")


# ── 7. Plan invariant: every clinic owns a subscription row ───────────────────
#
# A clinic with no subscription row is not an empty state, it is an invisible
# one: plans.LEGACY_ALIASES resolves its 'free' column to Plus and
# plan_state.evaluate(None) reports 'ok' with no expiry, so the clinic reads
# exactly like a healthy paying customer while being free, unbilled and
# unexpiring. Nineteen clinics sat in that state for five days in Aug 2026
# before anyone noticed, because nothing anywhere could tell the difference.
#
# WARN, never fail. Booting is not the fix for a data drift, and refusing to
# start would turn a billing problem into an outage.
print("\n[ 7 ] Plan invariant")
try:
    from sqlalchemy import create_engine, text

    engine = create_engine(os.environ["DATABASE_URL"])
    with engine.connect() as conn:
        orphans = conn.execute(text(
            "SELECT count(*) FROM clinics c "
            "WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.clinic_id = c.id)"
        )).scalar()
        legacy = conn.execute(text(
            "SELECT count(*) FROM clinics WHERE subscription_plan = 'free'"
        )).scalar()

    if orphans:
        warn(f"{orphans} clinic(s) have NO subscription row — they read as a free, "
             f"unexpiring Plus and no billing warning can reach them. "
             f"Run database/migrations/2026_08_30_signup_subscription_backfill.sql")
    else:
        ok("Every clinic owns a subscription row")

    if legacy:
        warn(f"{legacy} clinic(s) still on the retired 'free' plan name")
except Exception as e:
    warn(f"Could not check the plan invariant: {e}")


# ── Result ─────────────────────────────────────────────────────────────────────
print("\n========================================")
if errors:
    print(f"  PRE-FLIGHT FAILED — {len(errors)} error(s):\n")
    for e in errors:
        print(f"    ❌ {e}")
    print("\n  Fix the above issues and redeploy.\n")
    print("========================================\n")
    sys.exit(1)
else:
    print("  ALL CHECKS PASSED — starting server...\n")
    print("========================================\n")
