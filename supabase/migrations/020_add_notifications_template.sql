-- Add template column to notifications table if it doesn't exist
-- This fixes the "Column 'template' of relation 'notifications' does not exist" error

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'general';

-- Create index for template column
CREATE INDEX IF NOT EXISTS idx_notifications_template ON notifications(template);
