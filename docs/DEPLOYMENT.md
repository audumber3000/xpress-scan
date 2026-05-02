# MolarPlus Backend — Deployment Guide

## Architecture

```
Internet
    │
    ▼
Nginx (port 80 → 443 SSL)   [host process, not Docker]
    │
    ├── /api/v1/consent          ──▶  nexus container :8001
    ├── /api/v1/notifications    ──▶  nexus container :8001
    ├── /api/v1/reports          ──▶  nexus container :8001
    └── everything else          ──▶  backend container :8000
    
Docker (6 containers):
    ├── backend          FastAPI app         :8000 (internal)
    ├── backend-worker   RQ task worker      (internal)
    ├── nexus            Nexus FastAPI app   :8001 (internal)
    ├── nexus-worker     Nexus RQ worker     (internal)
    ├── db               PostgreSQL 16       (internal, volume-backed)
    └── redis            Redis 7             (internal, volume-backed)
```

**Live URLs:**
- Backend: `https://api.molarplus.com`
- Nexus: `https://api.molarplus.com/api/v1/...` (routed via Nginx)
- Server IP: `178.104.132.255`
- SSH: `root@178.104.132.255`

---

## Files Added to Repo

| File | Purpose |
|------|---------|
| `nexus-service/Dockerfile` | Docker image for nexus (includes weasyprint system deps) |
| `docker-compose.prod.yml` | Production compose — all 6 services |
| `.env.production.example` | Template for production env vars |
| `.env.production` | Actual secrets — **gitignored, never commit** |
| `deploy.sh` | One-command deploy script |

---

## One-Time Server Setup

### 1. Create Hetzner Server
- **OS**: Ubuntu 24.04 LTS
- **Size**: CX21 minimum (2 vCPU, 4 GB RAM)
- **Filesystem**: EXT4
- **Firewall rules** (inbound TCP): `22`, `80`, `443`

### 2. SSH In and Change Password
```bash
ssh root@<SERVER_IP>
passwd   # change to a strong password
```

### 3. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

### 4. Install Nginx + Certbot
```bash
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
```

### 5. Create Firebase Directory
```bash
mkdir -p /opt/molarplus
```

### 6. Upload Firebase JSON (from your local Mac)
```bash
scp backend/betterclinic-f1179-firebase-adminsdk-*.json \
    root@<SERVER_IP>:/opt/molarplus/firebase-service-account.json
```

### 7. Sync Environment Files (from your local Mac)
Since `.env` files and Firebase JSONs are gitignored, they must be synced manually:
```bash
sshpass -p '<PASSWORD>' rsync -avz --progress \
  .env.production \
  root@<SERVER_IP>:/root/molarplus/

# Sync Firebase JSON
scp backend/betterclinic-f1179-firebase-adminsdk-*.json \
    root@<SERVER_IP>:/opt/molarplus/firebase-service-account.json
```

### 8. Clone Repository (if not already done)
```bash
cd /root
git clone https://github.com/audumber3000/xpress-scan.git molarplus
cd molarplus
```

### 8. Set Up Nginx Config
```bash
cat > /etc/nginx/sites-available/api.molarplus.com << 'EOF'
server {
    listen 80;
    server_name api.molarplus.com;

    client_max_body_size 50M;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /api/v1/consent {
        proxy_pass http://localhost:8001;
    }
    location /api/v1/notifications {
        proxy_pass http://localhost:8001;
    }
    location /api/v1/reports {
        proxy_pass http://localhost:8001;
    }

    location / {
        proxy_pass http://localhost:8000;
        proxy_read_timeout 120s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/api.molarplus.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 9. Get SSL Certificate
```bash
certbot --nginx -d api.molarplus.com \
  --non-interactive --agree-tos \
  --email admin@molarplus.com \
  --redirect
```
SSL auto-renews via certbot's systemd timer. Certificate expires every 90 days.

### 10. Build and Start All Services
```bash
cd /root/molarplus
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 11. Verify Everything
```bash
# Check all 6 containers are running
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# Check health endpoints
curl https://api.molarplus.com/health
curl https://api.molarplus.com/api/v1/notifications/status
```

---

## Environment Variables

Copy `.env.production.example` → `.env.production` and fill in:

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER/PASSWORD/DB` | Database credentials |
| `JWT_SECRET` | 64-char hex string (`openssl rand -hex 32`) |
| `FIREBASE_JSON_PATH` | Absolute path on server to firebase JSON |
| `R2_*` | Cloudflare R2 storage credentials |
| `CASHFREE_*` | Cashfree payment gateway (production) |
| `META_*` | WhatsApp Meta Cloud API |
| `ZEPTO_*` | ZeptoMail email credentials |
| `MSG91_*` | SMS credentials |
| `OPENAI_API_KEY` | OpenAI |
| `GOOGLE_PLACES_API_KEY` | Google Places |
| `BACKEND_URL` | `https://api.molarplus.com` |
| `NEXUS_SERVICES_URL` | `https://api.molarplus.com` |

---

## Data Safety

**Docker named volumes** keep data safe across restarts and rebuilds:
- `molarplus_postgres_data` — all PostgreSQL data
- `molarplus_redis_data` — Redis queue state

⚠️ **NEVER run** `docker compose down -v` in production — this destroys volumes.

### Manual DB Backup
```bash
docker exec molarplus-db-1 pg_dump -U postgres molarplus > backup_$(date +%Y%m%d).sql
```

### Restore from Backup
```bash
cat backup_20260408.sql | docker exec -i molarplus-db-1 psql -U postgres molarplus
```

### Hetzner Snapshots
Take a manual server snapshot from Hetzner console before any major changes.

---

## Deploying Updates

**Always use `deploy.sh` — never run `docker compose up` manually.** The script runs schema checks, env checks, and a post-deploy health check that manual commands skip.

### Standard deploy

```bash
# 1. On your Mac — push to GitHub
git push origin main

# 2. On the server — pull and deploy
ssh root@178.104.132.255
cd /root/molarplus
git stash                  # preserve local docker-compose.prod.yml changes (port bindings)
git pull origin main
git stash pop
./deploy.sh                # runs all checks, builds, starts, verifies health
```

> ⚠️ The `git stash / pop` step is needed because `docker-compose.prod.yml` has a local change on the server (DB port 5432 exposed for the SSH tunnel from support server). Never `git reset --hard` — that would wipe the port binding and break the support tool DB connection.

### If you added a new column to `models.py`

Run the migration on prod **before** running `deploy.sh`. The deploy will refuse to proceed if the column is missing.

```bash
# On the server — run BEFORE deploy.sh
docker exec molarplus-db-1 psql -U postgres molarplus -c \
  "ALTER TABLE <table_name> ADD COLUMN IF NOT EXISTS <col_name> <type>;"

# Then deploy as normal
./deploy.sh
```

---

## Useful Commands (on server)

```bash
# View all container statuses
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# Tail live logs
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f

# Tail logs for one service
docker logs molarplus-backend-1 -f
docker logs molarplus-nexus-1 -f

# Restart a single service
docker compose -f docker-compose.prod.yml --env-file .env.production restart backend

# Nginx status
systemctl status nginx

# SSL cert status
certbot certificates
```

---

## Pre-deployment Safety Net

There are **3 layers** that catch errors before they hit production users.

---

### Layer 1 — `deploy.sh` pre-flight (runs on your Mac, before building)

`deploy.sh` validates your environment before wasting time on a build.

**What it checks:**
- `.env.production` file exists
- All critical env vars are non-empty (`DATABASE_URL`, `JWT_SECRET`, `FIREBASE_JSON_PATH`, `R2_*`, `CASHFREE_*`, `BACKEND_URL`)
- `DATABASE_URL` has no bare `@` in the password (must be `%40`)
- Firebase JSON path exists on disk
- **Schema migration check** — connects to the real prod DB and verifies every required column exists in `clinics`, `users`, `user_clinics`, `patients`, and `appointments` before wasting time on a build
- Backend health endpoint responds after deploy

**Run:**
```bash
# On the server
cd /root/molarplus
./deploy.sh
```

If any check fails, the script **exits before building** with a clear error message.

> ⚠️ **Why the schema check matters:** SQLAlchemy generates SQL from `models.py` at runtime. If you add a column to the model but forget the `ALTER TABLE` on prod, every query to that table crashes with `UndefinedColumn`. `create_all()` in tests always passes because it builds a fresh DB — only a check against the real DB catches this. The `referred_by_code` outage (April 2026) is the canonical example.
>
> If the schema check fails, `deploy.sh` prints the exact `ALTER TABLE` to run and exits. Fix the DB first, then re-run `deploy.sh`.

---

### Layer 2 — `preflight.py` (runs inside the container, before uvicorn starts)

`backend/preflight.py` is hooked into the Docker CMD. Every time the backend container starts, it runs first.

**What it checks (using pytest-style assertions):**
| Check | What it catches |
|-------|----------------|
| Required env vars | Missing config at runtime |
| `DATABASE_URL` `@` encoding | URL parse error breaking DB connection |
| PostgreSQL connectivity | DB unreachable, wrong credentials |
| Key tables exist (`users`, `clinics`, `patients`, `appointments`, `invoices`) | Fresh DB with no schema |
| Redis connectivity | Redis unreachable |
| Firebase JSON exists and is valid | Missing or corrupted credentials file |
| R2 credentials all present | Incomplete storage config |

**If any check fails → container exits immediately** with a clear printed error instead of starting up broken and crashing silently later.

**Framework:** Pure Python (`psycopg2`, `redis` library) — no pytest dependency at runtime.

**View preflight output:**
```bash
docker logs molarplus-backend-1 --tail 30
```

Example passing output:
```
[ 1 ] Environment variables
  ✅ DATABASE_URL is set
  ✅ JWT_SECRET is set
  ...

[ 3 ] Database connectivity
  ✅ Connected to PostgreSQL
  ✅ Table 'users' exists
  ✅ Table 'clinics' exists
  ...

========================================
  ALL CHECKS PASSED — starting server...
========================================
```

---

### Layer 3 — Smoke tests (pytest, run from your Mac after deploy)

**Framework:** `pytest` + `requests`  
**File:** `backend/tests/smoke/test_smoke.py`  
**Requires:** backend venv active, `requests` installed (already in `requirements.txt`)

**Run against production:**
```bash
cd backend
source venv/bin/activate
SMOKE_URL=https://api.molarplus.com pytest tests/smoke/test_smoke.py -v --noconftest
```

**Run against local dev:**
```bash
SMOKE_URL=http://localhost:8000 pytest tests/smoke/test_smoke.py -v --noconftest
```

**11 tests covering:**
| Test | What it checks |
|------|---------------|
| `test_backend_health` | `/health` returns `{"status": "healthy"}` |
| `test_login_endpoint_reachable` | Auth login endpoint responds (not 500) |
| `test_oauth_endpoint_reachable` | OAuth endpoint responds (not 500) |
| `test_protected_endpoint_requires_auth` (×4) | `/patients`, `/clinics/me`, `/appointments`, `/invoices` return 401/403 |
| `test_nexus_notifications_status` | Nexus is routed correctly via Nginx |
| `test_nexus_reports_endpoint_reachable` | Nexus reports endpoint is alive |
| `test_cors_headers` | CORS headers are present |
| `test_https_redirect` | HTTP → HTTPS redirect is working |

---

### Recommended deploy workflow

```
1. Make code changes locally
2. Run smoke tests against local dev (SMOKE_URL=http://localhost:8000)
3. Push changes + run deploy.sh on server
4. deploy.sh runs pre-flight env checks → builds → starts containers
5. Container auto-runs preflight.py before uvicorn (visible in docker logs)
6. Run smoke tests against production (SMOKE_URL=https://api.molarplus.com)
7. Done ✅
```

---

## Known Fixes Applied During Initial Deploy

| Issue | Fix |
|-------|-----|
| `libgdk-pixbuf2.0-0` not found | Renamed to `libgdk-pixbuf-2.0-0` in Debian Bookworm |
| `ModuleNotFoundError: sentry_sdk` | Added `sentry-sdk[fastapi]>=2.0.0` to both `backend/config/requirements.txt` and `nexus-service/requirements.txt` |
| `ImportError: jinja2 must be installed` | Added `jinja2` to `backend/config/requirements.txt` |
| `UndefinedColumn: clinics.referred_by_code` (April 2026) | Column added to `models.py` but `ALTER TABLE` never ran on prod. `create_all()` in tests masked it. Fix: added schema check to `deploy.sh` — now blocks deploy if any required column is missing. |
| Backend hung after redeploy (May 2026) | `_ensure_invoice_columns()` and `_ensure_case_paper_column()` ran `ALTER TABLE` from inside request handlers. After a fresh container start, every uvicorn worker process simultaneously asked for `ACCESS EXCLUSIVE` → one blocked → others piled up holding idle-in-transaction sessions → connection pool exhausted → all requests hung. Fix: converted both functions to no-ops; the columns are now declared in `models.py` and any future schema changes go through the migration block in `deploy.sh`. |

---

## Anti-patterns to avoid

These are concrete patterns that have caused outages — do not introduce them again.

### ❌ Never run `ALTER TABLE` from inside a request handler

Even with `IF NOT EXISTS`, `ALTER TABLE` requires `ACCESS EXCLUSIVE` on the table, which conflicts with **every** other lock — including plain `SELECT`. In a multi-worker uvicorn deployment, each worker process has its own module-level state, so per-process gate flags (`_ensured = True`) do not prevent N concurrent ALTERs after a restart. A single long-running transaction elsewhere (cron, webhook, dashboard polling) blocks the ALTER, the request handler's session stays open, the connection pool fills with idle-in-transaction sessions, and the entire backend hangs while CPU and memory look normal.

**Correct path:** schema changes go in `deploy.sh`'s migration block, which runs serialised against the prod DB **before** the new container starts. Add the column there, declare it in `models.py`, ship.

If you see `def _ensure_*_column(...)` or `db.execute(text("ALTER TABLE ..."))` inside `domains/*/routes/`, treat it as a P0 cleanup.

### ❌ Never look up clinic owners through `user_clinics` joins

The `user_clinics` association table exists but its `role` and `is_active` columns were never populated by the onboarding/signup paths. Any query of the form `JOIN user_clinics ON ... WHERE uc.role = 'clinic_owner' AND uc.is_active = TRUE` returns zero rows in production. This silently broke the `daily_summary_broadcast` job for ~23 days.

**Correct path:** look up owners directly off the `users` table — `User.clinic_id == clinic.id AND User.role == 'clinic_owner' AND User.is_active == True`. This matches the pattern already used by `/me` and the rest of the codebase.
