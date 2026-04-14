# MolarPlus Support Tool — Deployment Playbook

## Architecture

```
Internet
    │
    ▼
Nginx (port 80 → 443 SSL)   [host process]
    │
    ├── /api/  ──▶  support-backend (uvicorn :8002, systemd)
    └── /      ──▶  /var/www/support/ (built React SPA)

SSH Tunnel (systemd):
    localhost:5432 ──▶  SSH ──▶  178.104.132.255:5432 (prod Docker postgres)
```

**Servers:**
- Support tool server: `178.104.195.59` (root / `Prashant@135`)
- Main DB server: `178.104.132.255` (prod PostgreSQL via SSH tunnel)

**Live URL:** `https://support.molarplus.com`

**Default admin login:**
- Email: `admin@molarplus.com`
- Password: `admin123` (change after first login)

---

## One-Time Server Setup

This section documents everything done to set up `178.104.195.59` from scratch.

### 1. Change Default Password
New Hetzner servers force a password change on first SSH login — this blocks non-interactive SSH until done. Use `expect`:

```bash
expect -c '
set timeout 30
spawn ssh root@<NEW_SERVER_IP>
expect "assword:"
send "<OLD_PASSWORD>\r"
expect "Current password:"
send "<OLD_PASSWORD>\r"
expect "New password:"
send "Prashant@135\r"
expect "Retype new password:"
send "Prashant@135\r"
expect eof
'
```

### 2. Install Docker, Nginx, Certbot
```bash
curl -fsSL https://get.docker.com | sh
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx python3-venv nodejs npm
```

### 3. Configure UFW Firewall
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

### 4. Clone the Repository
```bash
cd /root
git clone https://github.com/audumber3000/xpress-scan.git support-tool
```

### 5. Write the Production `.env`
The `support/.env` is gitignored — must be written manually on the server every time.

```bash
cat > /root/support-tool/support/.env << 'EOF'
SUPPORT_PORT=8002
NEXUS_SERVICES_URL=https://api.molarplus.com
FRONTEND_URL=https://support.molarplus.com

DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@127.0.0.1:5432/molarplus
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<DB_PASSWORD>
POSTGRES_DB=molarplus

JWT_SECRET=<see .env.production on main server>
FIREBASE_JSON_PATH=/opt/molarplus/firebase-service-account.json

R2_ACCESS_KEY_ID=<see .env.production on main server>
R2_SECRET_ACCESS_KEY=<see .env.production on main server>
R2_ENDPOINT_URL=<see .env.production on main server>
R2_BUCKET_NAME=betterclinic-bdent

MSG91_AUTH_KEY=<see .env.production on main server>
MSG91_SMS_SENDER=MOLARPLUS
MSG91_WA_NAMESPACE=<see .env.production on main server>
MSG91_WHATSAPP_INTEGRATED_NUMBER=<see .env.production on main server>

CASHFREE_APP_ID=<see .env.production on main server>
CASHFREE_SECRET_KEY=<see .env.production on main server>
CASHFREE_ENV=production
SUBSCRIPTION_PROVIDER=cashfree

WA_TPL_APPOINTMENT_BOOKED=mp_appointment_booked_v2
WA_TPL_APPOINTMENT_CONFIRMED=mp_appointment_confirmed
WA_TPL_CHECKED_IN=mp_checked_in
WA_TPL_APPOINTMENT_REMINDER=mp_appointment_reminder
WA_TPL_INVOICE=mp_invoice_sent
WA_TPL_PRESCRIPTION=mp_prescription_sent
WA_TPL_CONSENT_FORM=mp_consent_form
WA_TPL_GOOGLE_REVIEW=mp_google_review
WA_TPL_DAILY_SUMMARY=mp_daily_summary
EOF
```

> ⚠️ `DATABASE_URL` points to `127.0.0.1:5432` — this goes through the SSH tunnel, NOT directly to the main server. The tunnel must be running.

### 6. Set Up SSH Tunnel to Production DB

The production PostgreSQL is inside Docker on `178.104.132.255` and is not publicly accessible. We use a persistent SSH tunnel.

**Generate key (once):**
```bash
ssh-keygen -t ed25519 -f /root/.ssh/db_tunnel_key -N ""
cat /root/.ssh/db_tunnel_key.pub
```

**Add public key to main server's `authorized_keys`** (run from your Mac):
```bash
expect -c '
set timeout 20
spawn ssh root@178.104.132.255
expect "assword:"
send "Prashant@135\r"
expect "#"
send "echo \"<PASTE_PUBLIC_KEY>\" >> /root/.ssh/authorized_keys && echo DONE\r"
expect "#"
send "exit\r"
expect eof
'
```

**Create systemd service for the tunnel:**
```bash
cat > /etc/systemd/system/db-tunnel.service << 'EOF'
[Unit]
Description=SSH Tunnel to MolarPlus Production DB
After=network.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/ssh \
  -i /root/.ssh/db_tunnel_key \
  -o StrictHostKeyChecking=no \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -N \
  -L 5432:localhost:5432 \
  root@178.104.132.255
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable db-tunnel
systemctl start db-tunnel
systemctl status db-tunnel
```

**Test the tunnel:**
```bash
python3 -c "
import psycopg2
conn = psycopg2.connect(host='127.0.0.1', port=5432, dbname='molarplus', user='postgres', password='<DB_PASSWORD>', connect_timeout=5)
cur = conn.cursor()
cur.execute('SELECT count(*) FROM clinics')
print('DB OK — clinics:', cur.fetchone()[0])
conn.close()
"
```

### 7. Install Backend Python Dependencies
```bash
cd /root/support-tool/support/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

> ⚠️ **Lesson learned**: `requirements.txt` must include `PyJWT`, `httpx`, and `aiofiles`. If any are missing, the backend crashes on startup — check `journalctl -u support-backend -n 20`.

### 8. Seed the Admin User
```bash
cd /root/support-tool/support/backend
./venv/bin/python3 seed_admin.py
```

This creates (or resets) `admin@molarplus.com` / `admin123`.

### 9. Create systemd Service for Backend
```bash
cat > /etc/systemd/system/support-backend.service << 'EOF'
[Unit]
Description=MolarPlus Support Dashboard Backend
After=network.target db-tunnel.service
Requires=db-tunnel.service

[Service]
Type=simple
WorkingDirectory=/root/support-tool/support/backend
ExecStart=/root/support-tool/support/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8002
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable support-backend
systemctl start support-backend
```

### 10. Build the Frontend

> ⚠️ **Critical lesson**: The frontend `.env` is gitignored. Always write it BEFORE building, or the build will bake in `localhost:8002` from the dev env and silently deploy broken code.
>
> ⚠️ **Critical lesson**: Always build locally on your Mac, then `scp` the `dist/` to the server. `npm run build` fails on the server due to a Node 18 / rollup / axios incompatibility.

**Build locally (on your Mac):**
```bash
# 1. Write production env
echo "VITE_API_URL=https://support.molarplus.com/api/v1" > support/frontend/.env

# 2. Verify the URL is correct before building
cat support/frontend/.env

# 3. Build
cd support/frontend
npm run build

# 4. Verify the built JS has the right URL (not localhost)
grep -o "localhost:8002\|support\.molarplus\.com" dist/assets/*.js

# 5. Deploy to server
sshpass -p 'Prashant@135' scp -r dist/. root@178.104.195.59:/var/www/support/
```

**Fix permissions on server:**
```bash
chown -R www-data:www-data /var/www/support
```

### 11. Configure Nginx

```bash
cat > /etc/nginx/sites-available/support.molarplus.com << 'EOF'
server {
    listen 80;
    server_name support.molarplus.com;

    client_max_body_size 20M;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /api/ {
        proxy_pass http://127.0.0.1:8002;
        proxy_read_timeout 60s;
    }

    location / {
        root /var/www/support;
        try_files $uri $uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/support.molarplus.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

> ⚠️ **Lesson learned**: Never serve from `/root/...` — Nginx's `www-data` user can't read it. Always copy dist to `/var/www/support/`.

### 12. Get SSL Certificate
Point `support.molarplus.com` A record → `178.104.195.59` first, then:

```bash
certbot --nginx -d support.molarplus.com \
  --non-interactive --agree-tos \
  --email admin@molarplus.com \
  --redirect
```

SSL auto-renews via certbot's systemd timer.

---

## Deploying Updates

### Code-only update (backend routes, models, etc.)

```bash
# 1. On your Mac — push to GitHub
git push origin main

# 2. On support server — pull and restart
ssh root@178.104.195.59
cd /root/support-tool
git pull origin main
systemctl restart support-backend
```

### Frontend update

Always build on your Mac, never on the server:

```bash
# 1. Ensure .env has production URL
echo "VITE_API_URL=https://support.molarplus.com/api/v1" > support/frontend/.env

# 2. Build
cd support/frontend && npm run build

# 3. Verify URL in built output
grep -o "localhost:8002\|support\.molarplus\.com" dist/assets/*.js

# 4. Deploy
sshpass -p 'Prashant@135' scp -r dist/. root@178.104.195.59:/var/www/support/

# 5. Fix permissions
ssh root@178.104.195.59 "chown -R www-data:www-data /var/www/support"
```

### Model schema change (new column in `support/backend/models.py`)

The support tool reads from the prod DB. SQLAlchemy `create_all` does NOT alter existing tables. Any new column in `models.py` must be manually added to prod first:

```bash
# Run on main server (178.104.132.255)
docker exec molarplus-db-1 psql -U postgres molarplus -c \
  "ALTER TABLE <table_name> ADD COLUMN IF NOT EXISTS <col_name> <type>;"
```

Then deploy the updated `models.py` and restart the support backend.

> ⚠️ **Lesson learned**: `referred_by_code` was in the model but not in prod DB — caused instant 500 on every page load. Always cross-check model columns against the actual DB before deploying.

---

## Useful Commands

```bash
# Check all service statuses
systemctl is-active db-tunnel support-backend nginx

# Tail live backend logs
journalctl -u support-backend -f

# Restart backend
systemctl restart support-backend

# Restart tunnel (if DB connection drops)
systemctl restart db-tunnel

# Test DB connectivity through tunnel
python3 -c "import psycopg2; conn = psycopg2.connect(host='127.0.0.1', port=5432, dbname='molarplus', user='postgres', password='<DB_PASSWORD>'); print('OK'); conn.close()"

# Reset admin password
cd /root/support-tool/support/backend && ./venv/bin/python3 seed_admin.py

# Check what URL is baked into deployed frontend JS
grep -o "localhost:8002\|support\.molarplus\.com" /var/www/support/assets/*.js

# Check actual prod DB columns (run from support server)
./venv/bin/python3 -c "
import psycopg2
conn = psycopg2.connect(host='127.0.0.1', port=5432, dbname='molarplus', user='postgres', password='<DB_PASSWORD>')
cur = conn.cursor()
cur.execute(\"SELECT column_name FROM information_schema.columns WHERE table_name='clinics'\")
print([r[0] for r in cur.fetchall()])
conn.close()
"
```

---

## Lessons Learned

| Mistake | What happened | Fix |
|---------|--------------|-----|
| Built frontend on server | `rollup`/`axios` incompatibility on Node 18 — build fails silently, deploys old cached `dist/` | Always build on Mac, scp dist to server |
| Forgot to write `.env` before build | `localhost:8002` baked into JS bundle | Write `.env` first, then verify URL in built JS before deploying |
| Frontend served from `/root/` | Nginx `www-data` can't read `/root/` — 500 on every request | Always copy dist to `/var/www/support/` |
| Model had `referred_by_code`, prod DB didn't | Every page load crashed with `UndefinedColumn` | Cross-check `models.py` against prod schema before deploy. Use `ADD COLUMN IF NOT EXISTS` for migrations |
| Hetzner cloud firewall blocked port 5432 | Port was exposed in Docker and UFW allowed, but still timed out — Hetzner network-level firewall blocked it | Use SSH tunnel instead of direct port exposure |
| New server requires interactive password change | Non-interactive SSH fails until password is changed | Use `expect` script to handle forced password change |
| Notification log columns not migrated | `provider_message_id` and `updated_at` added to `models.py` but `create_all` doesn't ALTER tables | Run explicit `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on prod for every new column |
