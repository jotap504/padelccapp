-- Step 1: Add column to existing table
ALTER TABLE ranking_configuration ADD COLUMN IF NOT EXISTS category_promotion_enabled BOOLEAN DEFAULT true;

-- Step 2: Create main requirements table
CREATE TABLE IF NOT EXISTS category_promotion_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    from_category INTEGER NOT NULL CHECK (from_category >= 1 AND from_category <= 8),
    matches_won_same_level INTEGER NOT NULL DEFAULT 30,
    matches_won_higher_level INTEGER NOT NULL DEFAULT 10,
    min_total_matches INTEGER NOT NULL DEFAULT 40,
    min_win_rate DECIMAL(5,2) NOT NULL DEFAULT 65.0,
    min_rating_promotion INTEGER NOT NULL DEFAULT 0,
    rating_buffer INTEGER NOT NULL DEFAULT 150,
    min_days_in_category INTEGER NOT NULL DEFAULT 60,
    max_promotions_per_season INTEGER DEFAULT 2,
    require_consistency BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id, from_category)
);

-- Step 3: Create history table
CREATE TABLE IF NOT EXISTS category_promotion_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    from_category INTEGER NOT NULL,
    to_category INTEGER NOT NULL,
    promotion_date TIMESTAMPTZ DEFAULT NOW(),
    total_matches_played INTEGER,
    matches_won_same_level INTEGER,
    matches_won_higher_level INTEGER,
    final_win_rate DECIMAL(5,2),
    final_rating INTEGER,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create player status table
CREATE TABLE IF NOT EXISTS player_category_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    current_category INTEGER NOT NULL,
    category_start_date TIMESTAMPTZ DEFAULT NOW(),
    matches_in_category INTEGER DEFAULT 0,
    wins_same_level INTEGER DEFAULT 0,
    wins_higher_level INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    season_promotions INTEGER DEFAULT 0,
    last_promotion_date TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, club_id)
);

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_category_promotion_requirements_club_category ON category_promotion_requirements(club_id, from_category);
CREATE INDEX IF NOT EXISTS idx_player_category_status_player_club ON player_category_status(player_id, club_id);
CREATE INDEX IF NOT EXISTS idx_category_promotion_history_player ON category_promotion_history(player_id);
