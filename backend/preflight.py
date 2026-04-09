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
