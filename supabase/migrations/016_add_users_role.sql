-- Add role column to users table for admin/superadmin checks
-- This fixes the "column 'role' does not exist" error in migration 016

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin'));

-- Update existing users to have 'user' role if null
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Create index for role column
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
