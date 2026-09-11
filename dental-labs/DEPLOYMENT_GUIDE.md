# Dental Labs — Deployment Guide

How the Dental Labs product (`dental-labs/`) is deployed to **Railway**, the exact steps,
the mistakes we hit the first time and how we fixed them, and how to redeploy.

> First deployed: 2026-06-05. Stack: FastAPI backend + managed Postgres + Vite/React frontend.
> All three run as separate services inside one Railway project.

---

## 1. Live environment

| Resource | Value |
|---|---|
| Railway project | `dental-labs` — `c9058106-962d-4795-83ec-dff4a48dd7aa` |
| Environment | `production` — `f1cc7611-2447-4ebb-b0ff-66d585a9486a` |
| Workspace | Audumber Chaudhari's Projects |
| Frontend URL | https://dental-labs-frontend-production.up.railway.app |
| Backend API URL | https://dental-labs-backend-production.up.railway.app |
| Dashboard | https://railway.com/project/c9058106-962d-4795-83ec-dff4a48dd7aa |

### Services

| Service | ID | Builder | Root dir | Notes |
|---|---|---|---|---|
| `dental-labs-backend` | `9fa6d8fa-c091-4bff-8a42-f2a2e22c96e8` | **Dockerfile** | `backend` | FastAPI/uvicorn, `PORT=8001`, healthcheck `/health` |
| `dental-labs-frontend` | `46c4e4d9-3f8c-4ca1-97ef-46ac21c8fe7b` | **railpack → Caddy** | `frontend` | Vite static build served by Railway's built-in Caddy |
| `Postgres` | `1ce7b900-f54b-4dec-b99e-06d0d1d452a1` | managed image | — | `postgres-ssl:18`, 5 GB volume |

---

## 2. Architecture notes that drive the deployment

- **Backend** is FastAPI ([backend/main.py](backend/main.py)). On startup it runs
  `Base.metadata.create_all(bind=engine)` so **tables auto-create on first boot** — no
  Alembic step is required for the first deploy.
- Backend uses **`weasyprint`** for PDF generation, which needs native libraries
  (Pango / Cairo / GDK-Pixbuf). This is why the backend builds from a **Dockerfile**
  instead of letting railpack guess — we control the `apt-get install`.
- **Frontend** is a Vite SPA. It reads the API base URL from **`VITE_BACKEND_URL`**, which
  Vite inlines **at build time** ([frontend/src/utils/api.js](frontend/src/utils/api.js)).
  So the variable must be set **before** the frontend build runs.
- Frontend talks to backend at `${VITE_BACKEND_URL}/api/v1/...`, so `VITE_BACKEND_URL`
  is the backend **root** domain (no `/api/v1` suffix).
- Auth is **email/password only** (bcrypt) — no Firebase/OAuth.

---

## 3. ⚠️ Mistakes we made the first time (read this before redeploying)

These are the real failures we hit, in order. Avoiding them makes a redeploy a single pass.

### Mistake 1 — Build failed: "Railpack could not determine how to build the app"
**Cause:** `railway up` uploads the **linked project root** (the directory where
`railway init` ran — here `dental-labs/`), **not** the current working directory. Even
though we ran `railway up` from inside `backend/`, Railway received the whole `dental-labs/`
folder (`backend/`, `frontend/`, `graphify-out/`, …) and couldn't find a single app to build.

**Fix:** Set each service's **root directory** so Railway builds from the right subfolder:
- `dental-labs-backend` → root directory `backend`
- `dental-labs-frontend` → root directory `frontend`

This is the standard **monorepo** pattern. Set it via the dashboard (Service → Settings →
Root Directory) or the Railway MCP `update_service` tool. **Do this immediately after
creating each service, before the first deploy.**

### Mistake 2 — Backend crashed at startup: `ModuleNotFoundError: No module named 'bcrypt'`
**Cause:** [backend/core/auth.py](backend/core/auth.py) imports `bcrypt`, but it was missing
from [backend/requirements.txt](backend/requirements.txt). The build succeeded; the container
crashed on boot, so the `/health` check kept returning "service unavailable".

**Fix:** Added `bcrypt>=4.0.0` to `requirements.txt`. **Lesson:** the Docker image only has
what's in `requirements.txt` — a working local venv can hide missing pins. Cross-check
imports against requirements before deploying.

### Mistake 3 — Frontend crashed: `npx: command not found`
**Cause:** We added a `Procfile` with `web: npx -y serve -s dist -l $PORT`. But Railway's
builder is **railpack** (not nixpacks); for a Vite SPA it already builds the static `dist/`
and serves it with **Caddy**. The runtime image is the Caddy static image — it has **no Node
and no `npx`**, so our Procfile start command failed.

**Fix:** **Deleted the frontend `Procfile`.** Let railpack auto-serve `dist/` with Caddy.
Don't override the start command for a static frontend on Railway.

> Bonus gotcha we pre-empted: a service needs a `PORT` the app actually listens on, matched
> to the domain's target port. We pinned the backend to `PORT=8001` (matches the Dockerfile
> `CMD` default and the domain target). Caddy on the frontend honors `$PORT` automatically.

---

## 4. Deploy config files (committed in the repo)

| File | Purpose |
|---|---|
| [backend/Dockerfile](backend/Dockerfile) | Python 3.12 + weasyprint native libs; `CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}` |
| [backend/.dockerignore](backend/.dockerignore) | Keeps `venv/`, `__pycache__/`, `.env`, `uploads/` out of the Docker build context |
| `backend/.railwayignore` | Trims the upload (venv, caches, `.env`) |
| `frontend/.railwayignore` | Excludes `node_modules/`, `dist/` (railpack rebuilds them) |
| `.railwayignore` (dental-labs root) | Trims the linked-root upload (venv, node_modules, `graphify-out/`, `.env`) |

> **Note:** there is intentionally **no** `frontend/Procfile` — see Mistake 3.

---

## 5. Environment variables

### Backend (`dental-labs-backend`)
| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference variable — resolves to the managed Postgres |
| `JWT_SECRET` | (random 32-byte hex) | Generate with `openssl rand -hex 32` |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_EXPIRY_DAYS` | `7` | |
| `CORS_ORIGINS` | `https://dental-labs-frontend-production.up.railway.app` | Must be the exact frontend origin (no `*` — `allow_credentials=True`) |
| `UPLOAD_DIR` | `./uploads` | ⚠️ ephemeral — see §7 |
| `MAX_UPLOAD_SIZE_MB` | `50` | |
| `PORT` | `8001` | Matches Dockerfile CMD + domain target port |

> The app loads `.env` with `load_dotenv(override=False)`, so Railway-injected vars win over
> any committed `.env`. `.env` is excluded from uploads anyway.

### Frontend (`dental-labs-frontend`)
| Variable | Value | Notes |
|---|---|---|
| `VITE_BACKEND_URL` | `https://dental-labs-backend-production.up.railway.app` | **Build-time** — set before deploying so Vite inlines it |
| `PORT` | `8080` | Caddy listens here; matches domain target |

---

## 6. Full deploy procedure (clean run)

Railway CLI is already installed (`railway --version` → 4.65+). Authenticate once with
`railway login`. Run all commands from the `dental-labs/` directory.

```bash
cd dental-labs

# 1. Create + link the project
railway init --name dental-labs

# 2. Add managed Postgres
railway add --database postgres --json

# 3. Create the two app services (empty)
railway add --service dental-labs-backend --json
railway add --service dental-labs-frontend --json

# 4. SET ROOT DIRECTORIES FIRST (avoids Mistake 1)
#    Dashboard: each Service → Settings → Root Directory
#      dental-labs-backend  -> backend
#      dental-labs-frontend -> frontend
#    (or use the Railway MCP update_service tool: root_directory=backend / frontend)
#    Also set backend healthcheck path -> /health

# 5. Backend variables
railway variables --service dental-labs-backend \
  --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}" \
  --set "JWT_SECRET=$(openssl rand -hex 32)" \
  --set "JWT_ALGORITHM=HS256" \
  --set "JWT_EXPIRY_DAYS=7" \
  --set "UPLOAD_DIR=./uploads" \
  --set "MAX_UPLOAD_SIZE_MB=50" \
  --set "PORT=8001" \
  --skip-deploys

# 6. Backend domain (target port must match PORT)
railway domain --service dental-labs-backend --port 8001

# 7. Frontend variables (backend URL is build-time!)
railway variables --service dental-labs-frontend \
  --set "VITE_BACKEND_URL=https://dental-labs-backend-production.up.railway.app" \
  --set "PORT=8080" \
  --skip-deploys

# 8. Frontend domain
railway domain --service dental-labs-frontend

# 9. Now that the frontend domain is known, set backend CORS to it
railway variables --service dental-labs-backend \
  --set "CORS_ORIGINS=https://dental-labs-frontend-production.up.railway.app"

# 10. Deploy both (uploads the linked root; root dirs select the subfolders)
railway up --service dental-labs-backend  --detach -m "backend deploy"
railway up --service dental-labs-frontend --detach -m "frontend deploy"
```

### Verify

```bash
# Logs
railway logs --service dental-labs-backend          # expect: "Application startup complete" + GET /health 200
railway logs --service dental-labs-frontend         # expect: Caddy serving requests

# Smoke test
curl -s https://dental-labs-backend-production.up.railway.app/health      # {"status":"healthy",...}
curl -s -o /dev/null -w "%{http_code}\n" https://dental-labs-frontend-production.up.railway.app/   # 200
# CORS preflight should be 200:
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  -H "Origin: https://dental-labs-frontend-production.up.railway.app" \
  -H "Access-Control-Request-Method: POST" \
  https://dental-labs-backend-production.up.railway.app/api/v1/auth/login
```

---

## 7. Redeploying after code changes

```bash
cd dental-labs
railway up --service dental-labs-backend  --detach -m "what changed"   # backend changes
railway up --service dental-labs-frontend --detach -m "what changed"   # frontend changes
```

- Root directories, variables, and domains persist — you only re-run `railway up`.
- **If you change `VITE_BACKEND_URL`** you must redeploy the frontend (build-time inlining).
- **If the backend URL changes**, update both `VITE_BACKEND_URL` (frontend) and
  `CORS_ORIGINS` (backend), then redeploy both.

---

## 8. Known limitations / TODO

- **Ephemeral uploads:** the backend writes to local `./uploads`, which is **wiped on every
  redeploy/restart** on Railway. Before handling real user files, attach a **Railway volume**
  to the backend (mount at the uploads path) or switch to object storage (S3 / Railway bucket).
- **Schema migrations:** first deploy relies on `create_all`. For schema *changes* on an
  existing DB, run Alembic — `create_all` does not alter existing tables.
- **JWT secret:** generated per-environment; rotating it invalidates all existing tokens.

---

## 9. Railway reference

- Railway docs: https://docs.railway.com
- Railpack (the builder) docs: https://railpack.com
- Key CLI commands used here: `railway init`, `railway add`, `railway variables`,
  `railway domain`, `railway up`, `railway logs`, `railway redeploy`, `railway status --json`.
- Reference/config-as-code and Dockerfile builds: https://docs.railway.com/guides/dockerfiles
- Monorepo / root directory: https://docs.railway.com/guides/monorepo
