-- Migration: Add practice licence fields to clinics table
-- Date: 2026-07-16
-- Description: Backs the "License" tab on the Clinic Profile page — council /
--              clinical-establishment registration number, the issuing
--              authority, and the expiry date.
-- Safe to re-run: Yes (uses ADD COLUMN IF NOT EXISTS)
-- Nullable with no default, so existing clinics are unaffected.

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS license_number VARCHAR(80);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS license_authority VARCHAR(120);
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS license_expiry DATE;
