-- Migration: Inventory ledger (stock movements)
-- Date: 2026-07-17
-- Description: Records every stock movement — usage from case papers and manual
--              in/out entries. direction='out' decrements stock, 'in' increments;
--              deleting a row reverses it. patient_id is optional (manual/general
--              entries). item_name/unit snapshotted for readability.
-- Safe to re-run: Yes (CREATE TABLE IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
    patient_id INTEGER REFERENCES patients(id),
    case_paper_id INTEGER REFERENCES case_papers(id),
    inventory_item_id INTEGER REFERENCES inventory_items(id),
    direction VARCHAR NOT NULL DEFAULT 'out',
    item_name VARCHAR NOT NULL,
    quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit VARCHAR,
    note VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_inventory_transactions_clinic ON inventory_transactions (clinic_id);
CREATE INDEX IF NOT EXISTS ix_inventory_transactions_case_paper ON inventory_transactions (case_paper_id);
CREATE INDEX IF NOT EXISTS ix_inventory_transactions_item ON inventory_transactions (inventory_item_id);
