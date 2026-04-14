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

Code updates are handled via `git pull` on the server.

From your local Mac:
1. Ensure changes are pushed to `main`.
2. (Optional) If `.env.production` changed, sync it:
   `sshpass -p '<PASSWORD>' scp .env.production root@178.104.132.255:/root/molarplus/`

On the server:
```bash
# 1. Pull latest changes
cd /root/molarplus
git reset --hard HEAD  # Clean up any local drift
git pull origin main

# 2. Rebuild and restart
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
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
- Backend health endpoint responds after deploy

**Run:**
```bash
# On the server
cd /root/molarplus
./deploy.sh
```

If any check fails, the script **exits before building** with a clear error message.

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
