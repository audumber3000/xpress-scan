-- Migration: Add case_paper_id to patient_documents table
-- Date: 2025-01-XX
-- Description: Adds case_paper_id foreign key to track which case paper a document belongs to

-- Add the case_paper_id column (nullable to support existing documents)
ALTER TABLE patient_documents ADD COLUMN case_paper_id INTEGER;

-- Add foreign key constraint
-- Note: SQLite doesn't support adding foreign keys to existing tables directly
-- This is handled by the SQLAlchemy model definition

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_patient_documents_case_paper_id ON patient_documents(case_paper_id);

-- Optional: Update existing documents to be unlinked (NULL case_paper_id means general patient document)
-- No action needed as new column defaults to NULL
