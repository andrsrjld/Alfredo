-- Migration 006: Add is_active toggle to whitelisted_pms
-- Allows per-contact enable/disable of Alfredo replies

ALTER TABLE whitelisted_pms
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Update existing contacts to active (they were added before this feature existed)
UPDATE whitelisted_pms SET is_active = true WHERE is_active IS NULL;
