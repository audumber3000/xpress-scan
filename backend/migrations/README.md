# Database Migrations

This directory contains SQL migration scripts for the xpress-scan database.

## How to Run Migrations

### Using SQLite (if using SQLite database)
```bash
sqlite3 your_database.db < migrations/add_password_hash.sql
```

### Using PostgreSQL (if using PostgreSQL)
```bash
psql -U your_username -d your_database -f migrations/add_password_hash.sql
```

### Using Python (recommended for SQLAlchemy)
```python
from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    with open('migrations/add_password_hash.sql', 'r') as f:
        sql = f.read()
        conn.execute(text(sql))
        conn.commit()
```

## Available Migrations

### add_password_hash.sql
- **Date**: 2025-12-21
- **Description**: Adds `password_hash` column to users table to enable OAuth users to set passwords for desktop app access
- **Safe to re-run**: Yes (uses IF NOT EXISTS)

## Migration Order

Run migrations in chronological order:
1. add_password_hash.sql
