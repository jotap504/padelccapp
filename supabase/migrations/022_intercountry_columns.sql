-- HOTFIX: Add missing columns to intercountry_tournaments table
-- These columns are needed for the enhanced intercountry features

-- Add gender column
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'mixed'));

-- Add list_manager_id column (for good-faith list manager)
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS list_manager_id UUID REFERENCES users(id);

-- Add registration_deadline column
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;

-- Add created_by column
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Add registration_deadline to intercountry_participants for individual players
ALTER TABLE intercountry_participants 
ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;

-- Add gender to intercountry_participants
ALTER TABLE intercountry_participants 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'mixed'));

-- Add list_manager_id to intercountry_participants (club-level list manager)
ALTER TABLE intercountry_participants 
ADD COLUMN IF NOT EXISTS list_manager_id UUID REFERENCES users(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_intercountry_tournaments_gender ON intercountry_tournaments(gender);
CREATE INDEX IF NOT EXISTS idx_intercountry_tournaments_list_manager ON intercountry_tournaments(list_manager_id);
CREATE INDEX IF NOT EXISTS idx_intercountry_participants_gender ON intercountry_participants(gender);
CREATE INDEX IF NOT EXISTS idx_intercountry_participants_list_manager ON intercountry_participants(list_manager_id);
