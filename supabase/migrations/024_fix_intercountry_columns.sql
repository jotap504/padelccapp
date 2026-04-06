-- HOTFIX: Add all missing columns to intercountry_tournaments
-- The table exists but is missing critical columns

-- Core columns from 004_tournaments_intercountry.sql
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS season INTEGER NOT NULL DEFAULT 2024;

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Torneo sin nombre';

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'league' CHECK (type IN ('league', 'cup', 'supercup'));

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS category INTEGER CHECK (category BETWEEN 1 AND 8);

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'in_progress', 'finished'));

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'home_away' CHECK (format IN ('home_away', 'neutral', 'single_round'));

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS rules JSONB;

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enhanced columns from 022_intercountry_columns.sql
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'mixed'));

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS list_manager_id UUID REFERENCES users(id);

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;

ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Add default values for existing rows
UPDATE intercountry_tournaments SET season = 2024 WHERE season IS NULL;
UPDATE intercountry_tournaments SET name = 'Torneo ' || id::text WHERE name IS NULL OR name = '';
UPDATE intercountry_tournaments SET type = 'league' WHERE type IS NULL;
UPDATE intercountry_tournaments SET status = 'draft' WHERE status IS NULL;
UPDATE intercountry_tournaments SET format = 'home_away' WHERE format IS NULL;
UPDATE intercountry_tournaments SET start_date = NOW() WHERE start_date IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_intercountry_tournaments_season ON intercountry_tournaments(season);
CREATE INDEX IF NOT EXISTS idx_intercountry_tournaments_status ON intercountry_tournaments(status);
CREATE INDEX IF NOT EXISTS idx_intercountry_tournaments_type ON intercountry_tournaments(type);
