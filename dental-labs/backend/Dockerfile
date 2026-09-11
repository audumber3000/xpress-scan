FROM python:3.12-slim

# WeasyPrint native dependencies (Pango / Cairo / GDK-Pixbuf) + fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libgdk-pixbuf-2.0-0 \
        libcairo2 \
        libffi-dev \
        shared-mime-info \
        fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Keep the deployed schema in step with the application before accepting traffic.
# Alembic upgrades are idempotent, so this is safe on subsequent restarts.
CMD sh -c "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"
