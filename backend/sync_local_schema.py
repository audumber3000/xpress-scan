"""
One-off helper: bring the LOCAL dev DB schema in line with the SQLAlchemy models
(which is the source of truth for prod). Adds any tables/columns that exist in
models.py but are missing in the local database. Non-destructive: never drops or
alters existing columns.
"""
import models  # noqa: F401 - registers all tables on Base.metadata
from models import Base
from database import engine
from sqlalchemy import inspect, text


def sa_type_to_ddl(col):
    try:
        return col.type.compile(dialect=engine.dialect)
    except Exception:
        return "VARCHAR"


def main():
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())

    # 1. Create any brand-new tables
    Base.metadata.create_all(bind=engine)

    insp = inspect(engine)  # refresh
    added = []

    # 2. Add missing columns to existing tables
    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing_tables:
            added.append(f"[new table] {table_name}")
            continue
        db_cols = {c["name"] for c in insp.get_columns(table_name)}
        for col in table.columns:
            if col.name in db_cols:
                continue
            ddl_type = sa_type_to_ddl(col)
            default = ""
            if col.default is not None and getattr(col.default, "is_scalar", False):
                val = col.default.arg
                if isinstance(val, bool):
                    default = f" DEFAULT {str(val).upper()}"
                elif isinstance(val, (int, float)):
                    default = f" DEFAULT {val}"
                elif isinstance(val, str):
                    default = f" DEFAULT '{val}'"
            stmt = f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS "{col.name}" {ddl_type}{default}'
            with engine.begin() as conn:
                conn.execute(text(stmt))
            added.append(f"{table_name}.{col.name} ({ddl_type}{default})")

    if added:
        print("Applied changes:")
        for a in added:
            print("  +", a)
    else:
        print("Local schema already matches models. Nothing to add.")


if __name__ == "__main__":
    main()
