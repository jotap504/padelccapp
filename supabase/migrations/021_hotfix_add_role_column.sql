-- HOTFIX: Add role column if it doesn't exist
-- This is a safety measure to ensure role column exists before any policy uses it

DO $$
BEGIN
    -- Check if role column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
        
        -- Add check constraint separately to avoid issues
        ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('user', 'admin', 'superadmin'));
        
        -- Update existing users
        UPDATE users SET role = 'user' WHERE role IS NULL;
        
        -- Create index
        CREATE INDEX idx_users_role ON users(role);
        
        RAISE NOTICE 'Role column added to users table';
    ELSE
        RAISE NOTICE 'Role column already exists';
    END IF;
END $$;
