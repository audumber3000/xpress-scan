# MolarPlus Support Tool — backend image for Railway.
#
# The support backend reads the production PostgreSQL that lives privately inside
# Docker on the main Hetzner server. Railway can't reach it directly, so this
# image opens an SSH tunnel (autossh) to the main server on boot and points
# DATABASE_URL at 127.0.0.1:5432 (see entrypoint.sh + docs/SUPPORT_DEPLOYMENT.md).
FROM python:3.12-slim

# openssh-client + autossh power the persistent DB tunnel.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-client autossh \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x entrypoint.sh

# Railway provides $PORT at runtime; default mirrors the Hetzner setup.
ENV PORT=8002
EXPOSE 8002

CMD ["./entrypoint.sh"]
