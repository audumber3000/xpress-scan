-- Migration: Convert from Radiology to Dental Clinic
-- Date: 2025-12-21
-- Description: Rename scan_types to treatment_types and update all references

-- Rename table
ALTER TABLE scan_types RENAME TO treatment_types;

-- Update patient table column
ALTER TABLE patients RENAME COLUMN scan_type TO treatment_type;

-- Update payments table foreign key column
ALTER TABLE payments RENAME COLUMN scan_type_id TO treatment_type_id;

-- Update clinic specialization default for existing clinics
UPDATE clinics SET specialization = 'dental' WHERE specialization = 'radiology';

-- Note: This migration is safe to run multiple times (idempotent for UPDATE)
