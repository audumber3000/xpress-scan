-- Migration: Invoice partial-payment history
-- Date: 2026-07-18
-- Description: Itemised installments against an invoice. An invoice's
--              paid/due/status derive from the sum of these rows. Backfills a
--              single 'legacy' row for invoices that already had a paid_amount,
--              so sum(rows) == paid_amount for existing data.
-- Safe to re-run: Yes (IF NOT EXISTS + NOT EXISTS backfill guard)

CREATE TABLE IF NOT EXISTS invoice_payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    clinic_id INTEGER NOT NULL REFERENCES clinics(id),
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    paid_on DATE,
    method VARCHAR,
    note VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_invoice_payments_invoice ON invoice_payments (invoice_id);

INSERT INTO invoice_payments (invoice_id, clinic_id, amount, paid_on, method, note, created_at)
SELECT i.id, i.clinic_id, i.paid_amount,
       COALESCE(i.paid_at::date, i.created_at::date),
       i.payment_mode, 'Existing paid amount',
       COALESCE(i.paid_at, i.created_at, NOW())
FROM invoices i
WHERE COALESCE(i.paid_amount, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM invoice_payments p WHERE p.invoice_id = i.id);
