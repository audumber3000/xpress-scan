-- Migration: Add password_hash column to users table
-- Date: 2025-12-21
-- Description: Add password_hash field to allow OAuth users to set passwords for desktop access

-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Add index for better query performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_password_hash ON users(password_hash);

-- Note: This migration is safe to run multiple times (idempotent)
-- The IF NOT EXISTS clause ensures the column is only added if it doesn't exist
