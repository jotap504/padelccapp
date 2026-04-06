-- Category Promotion Requirements Configuration
-- Makes category promotion more challenging and realistic

-- Add category promotion requirements to ranking_configuration
ALTER TABLE ranking_configuration ADD COLUMN IF NOT EXISTS category_promotion_enabled BOOLEAN DEFAULT true;

-- Category Promotion Requirements Table
CREATE TABLE IF NOT EXISTS category_promotion_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- From Category (1-8, where 1 is highest)
    from_category INTEGER NOT NULL CHECK (from_category >= 1 AND from_category <= 8),
    
    -- Promotion Requirements
    matches_won_same_level INTEGER NOT NULL DEFAULT 30,     -- Wins vs same category
    matches_won_higher_level INTEGER NOT NULL DEFAULT 10,  -- Wins vs higher category
    min_total_matches INTEGER NOT NULL DEFAULT 40,           -- Minimum total matches played
    min_win_rate DECIMAL(5,2) NOT NULL DEFAULT 65.0,       -- Minimum win rate percentage
    
    -- Rating Requirements
    min_rating_promotion INTEGER NOT NULL DEFAULT 0,          -- Minimum rating to promote
    rating_buffer INTEGER NOT NULL DEFAULT 150,               -- Points buffer above category threshold
    
    -- Time Requirements
    min_days_in_category INTEGER NOT NULL DEFAULT 60,         -- Minimum days in current category
    
    -- Additional Constraints
    max_promotions_per_season INTEGER DEFAULT 2,              -- Limit promotions per season
    require_consistency BOOLEAN DEFAULT true,                   -- Require consistent performance
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Each club can have only one requirement set per category
    UNIQUE(club_id, from_category)
);

-- Insert Default Requirements for All Categories
-- These are more challenging and realistic requirements

-- 8va to 7ma (Entry level promotion)
INSERT INTO category_promotion_requirements (club_id, from_category, matches_won_same_level, matches_won_higher_level, min_total_matches, min_win_rate, min_rating_promotion, rating_buffer) 
SELECT id, 8, 25, 8, 35, 60.0, 600, 100 FROM clubs
ON CONFLICT (club_id, from_category) DO NOTHING;

-- 7ma to 6ta
INSERT INTO category_promotion_requirements (club_id, from_category, matches_won_same_level, matches_won_higher_level, min_total_matches, min_win_rate, min_rating_promotion, rating_buffer) 
SELECT id, 7, 25, 8, 35, 62.0, 700, 100 FROM clubs
ON CONFLICT (club_id, from_category) DO NOTHING;

-- 6ta to 5ta
INSERT INTO category_promotion_requirements (club_id, from_category, matches_won_same_level, matches_won_higher_level, min_total_matches, min_win_rate, min_rating_promotion, rating_buffer) 
SELECT id, 6, 28, 10, 40, 65.0, 800, 125 FROM clubs
ON CONFLICT (club_id, from_category) DO NOTHING;

-- 5ta to 4ta
INSERT INTO category_promotion_requirements (club_id, from_category, matches_won_same_level, matches_won_higher_level, min_total_matches, min_win_rate, min_rating_promotion, rating_buffer) 
SELECT id, 5, 28, 10, 40, 65.0, 900, 125 FROM clubs
ON CONFLICT (club_id, from_category) DO NOTHING;

-- 4ta to 3ra (Mid level promotion - harder)
INSERT INTO category_promotion_requirements (club_id, from_category, matches_won_same_level, matches_won_higher_level, min_total_matches, min_win_rate, min_rating_promotion, rating_buffer) 
SELECT id, 4, 30, 12, 45, 68.0, 1050, 150 FROM clubs
ON CONFLICT (club_id, from_category) DO NOTHING;

-- 3ra to 2da (Advanced level promotion - much harder)
INSERT INTO category_promotion_requirements (club_id, from_category, matches_won_same_level, matches_won_higher_level, min_total_matches, min_win_rate, min_rating_promotion, rating_buffer) 
SELECT id, 3, 30, 12, 45, 70.0, 1200, 150 FROM clubs
ON CONFLICT (club_id, from_category) DO NOTHING;

-- 2da to 1ra (Elite level promotion - very hard)
INSERT INTO category_promotion_requirements (club_id, from_category, matches_won_same_level, matches_won_higher_level, min_total_matches, min_win_rate, min_rating_promotion, rating_buffer) 
SELECT id, 2, 35, 15, 50, 75.0, 1350, 200 FROM clubs
ON CONFLICT (club_id, from_category) DO NOTHING;

-- Category Promotion History (to track all promotions)
CREATE TABLE IF NOT EXISTS category_promotion_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- Promotion Details
    from_category INTEGER NOT NULL,
    to_category INTEGER NOT NULL,
    promotion_date TIMESTAMPTZ DEFAULT NOW(),
    
    -- Requirements Met
    total_matches_played INTEGER,
    matches_won_same_level INTEGER,
    matches_won_higher_level INTEGER,
    final_win_rate DECIMAL(5,2),
    final_rating INTEGER,
    
    -- Admin Approval
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player Category Status (to track current category progress)
CREATE TABLE IF NOT EXISTS player_category_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- Current Category Info
    current_category INTEGER NOT NULL,
    category_start_date TIMESTAMPTZ DEFAULT NOW(),
    
    -- Progress Tracking
    matches_in_category INTEGER DEFAULT 0,
    wins_same_level INTEGER DEFAULT 0,
    wins_higher_level INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    
    -- Season Tracking
    season_promotions INTEGER DEFAULT 0,
    last_promotion_date TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(player_id, club_id)
);

-- Function to check if player is eligible for promotion
CREATE OR REPLACE FUNCTION check_promotion_eligibility(
    p_player_id UUID,
    p_club_id UUID
) RETURNS TABLE (
    eligible BOOLEAN,
    from_category INTEGER,
    to_category INTEGER,
    requirements_met JSONB,
    missing_requirements JSONB
) AS $$
DECLARE
    v_current_category INTEGER;
    v_requirements RECORD;
    v_player_status RECORD;
    v_eligible BOOLEAN := false;
    v_requirements_met JSONB := '{}';
    v_missing_requirements JSONB := '{}';
BEGIN
    -- Get player's current category
    SELECT current_category INTO v_current_category
    FROM player_category_status
    WHERE player_id = p_player_id AND club_id = p_club_id;
    
    -- If no category status, create one
    IF v_current_category IS NULL THEN
        INSERT INTO player_category_status (player_id, club_id, current_category)
        VALUES (p_player_id, p_club_id, 8) -- Start at lowest category
        RETURNING current_category INTO v_current_category;
    END IF;
    
    -- Get promotion requirements for this category
    SELECT * INTO v_requirements
    FROM category_promotion_requirements
    WHERE club_id = p_club_id AND from_category = v_current_category;
    
    -- If no requirements found, return not eligible
    IF v_requirements IS NULL OR v_current_category = 1 THEN
        RETURN;
    END IF;
    
    -- Get player's current stats
    SELECT 
        pcs.matches_in_category,
        pcs.wins_same_level,
        pcs.wins_higher_level,
        pcs.total_wins,
        u.rating,
        u.total_matches,
        u.win_rate
    INTO v_player_status
    FROM player_category_status pcs
    JOIN users u ON u.id = pcs.player_id
    WHERE pcs.player_id = p_player_id AND pcs.club_id = p_club_id;
    
    -- Check each requirement
    v_requirements_met := jsonb_build_object(
        'matches_won_same_level', v_player_status.wins_same_level >= v_requirements.matches_won_same_level,
        'matches_won_higher_level', v_player_status.wins_higher_level >= v_requirements.matches_won_higher_level,
        'min_total_matches', v_player_status.matches_in_category >= v_requirements.min_total_matches,
        'min_win_rate', v_player_status.win_rate >= v_requirements.min_win_rate,
        'min_rating_promotion', v_player_status.rating >= v_requirements.min_rating_promotion
    );
    
    -- Check what's missing
    v_missing_requirements := jsonb_build_object(
        'matches_won_same_level', GREATEST(0, v_requirements.matches_won_same_level - v_player_status.wins_same_level),
        'matches_won_higher_level', GREATEST(0, v_requirements.matches_won_higher_level - v_player_status.wins_higher_level),
        'min_total_matches', GREATEST(0, v_requirements.min_total_matches - v_player_status.matches_in_category),
        'min_win_rate', GREATEST(0, v_requirements.min_win_rate - v_player_status.win_rate),
        'min_rating_promotion', GREATEST(0, v_requirements.min_rating_promotion - v_player_status.rating)
    );
    
    -- Check if all requirements are met
    v_eligible := (
        v_player_status.wins_same_level >= v_requirements.matches_won_same_level AND
        v_player_status.wins_higher_level >= v_requirements.matches_won_higher_level AND
        v_player_status.matches_in_category >= v_requirements.min_total_matches AND
        v_player_status.win_rate >= v_requirements.min_win_rate AND
        v_player_status.rating >= v_requirements.min_rating_promotion
    );
    
    RETURN QUERY SELECT 
        v_eligible,
        v_current_category,
        v_current_category - 1,
        v_requirements_met,
        v_missing_requirements;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_category_promotion_requirements_club_category ON category_promotion_requirements(club_id, from_category);
CREATE INDEX IF NOT EXISTS idx_player_category_status_player_club ON player_category_status(player_id, club_id);
CREATE INDEX IF NOT EXISTS idx_category_promotion_history_player ON category_promotion_history(player_id);
