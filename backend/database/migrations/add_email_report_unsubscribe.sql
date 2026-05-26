-- Migration: Add email_report_unsubscribed flag to users table
-- Date: 2026-05-22
-- Description: Allows clinic owners to opt out of daily/weekly/monthly email reports
--              while still receiving WhatsApp summaries
-- Safe to re-run: Yes (uses IF NOT EXISTS via ADD COLUMN IF NOT EXISTS)

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_report_unsubscribed BOOLEAN DEFAULT FALSE;
