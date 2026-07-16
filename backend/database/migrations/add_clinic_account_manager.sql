-- Migration: Add assigned account-manager fields to clinics table
-- Date: 2026-07-16
-- Description: Backs the "My Account Manager" section on Support Center. Set by
--              the support team (not by the clinic — these fields are absent
--              from ClinicUpdateDTO on purpose). When blank, the UI shows an
--              empty state rather than a placeholder person.
-- Safe to re-run: Yes (uses ADD COLUMN IF NOT EXISTS)
-- Nullable with no default, so existing clinics are unaffected.

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS account_manager_name VARCHAR(120);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS account_manager_role VARCHAR(120);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS account_manager_email VARCHAR(120);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS account_manager_phone VARCHAR(20);
