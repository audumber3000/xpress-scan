#!/usr/bin/env sh
# Boot sequence for the support backend on Railway:
#   1. materialise secrets (SSH key, Firebase JSON) from env vars,
#   2. open an SSH tunnel to the private prod Postgres,
#   3. wait for the tunnel, then start uvicorn.
set -e

mkdir -p /root/.ssh
chmod 700 /root/.ssh

# --- SSH key for the DB tunnel ----------------------------------------------
# Prefer base64 (SSH_TUNNEL_KEY_B64) — env vars mangle multiline values, and a
# corrupted key silently breaks the tunnel. Fall back to a raw key if provided.
if [ -n "$SSH_TUNNEL_KEY_B64" ]; then
  echo "$SSH_TUNNEL_KEY_B64" | base64 -d > /root/.ssh/id_tunnel
  chmod 600 /root/.ssh/id_tunnel
elif [ -n "$SSH_TUNNEL_KEY" ]; then
  printf '%s\n' "$SSH_TUNNEL_KEY" > /root/.ssh/id_tunnel
  chmod 600 /root/.ssh/id_tunnel
else
  echo "FATAL: SSH_TUNNEL_KEY_B64/SSH_TUNNEL_KEY not set — cannot reach the prod DB." >&2
  exit 1
fi

# --- Firebase service account JSON (base64 in FIREBASE_JSON_B64) -------------
if [ -n "$FIREBASE_JSON_B64" ] && [ -n "$FIREBASE_JSON_PATH" ]; then
  mkdir -p "$(dirname "$FIREBASE_JSON_PATH")"
  echo "$FIREBASE_JSON_B64" | base64 -d > "$FIREBASE_JSON_PATH"
fi

# --- SSH tunnel to the private prod Postgres --------------------------------
# DB_TUNNEL_HOST e.g. "root@178.104.132.255"; DB_TUNNEL_SSH_PORT defaults to 22.
: "${DB_TUNNEL_HOST:?DB_TUNNEL_HOST required (e.g. root@178.104.132.255)}"
: "${DB_TUNNEL_SSH_PORT:=22}"

echo "Opening DB tunnel via $DB_TUNNEL_HOST ..."
autossh -M 0 -f -N \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -i /root/.ssh/id_tunnel \
  -p "$DB_TUNNEL_SSH_PORT" \
  -L 5432:localhost:5432 \
  "$DB_TUNNEL_HOST"

# --- Wait for the tunnel to accept connections before starting the app ------
echo "Waiting for DB tunnel on 127.0.0.1:5432 ..."
i=0
until python -c "import socket; socket.create_connection(('127.0.0.1', 5432), 2)" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "FATAL: DB tunnel did not come up within 30s." >&2
    exit 1
  fi
  sleep 1
done
echo "DB tunnel is up."

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8002}"
