-- Enhanced Ranking Points System with Configurable Parameters

-- Ranking Configuration Table
CREATE TABLE IF NOT EXISTS ranking_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- Base Points Configuration
    base_points_winner INTEGER DEFAULT 20,
    base_points_loser INTEGER DEFAULT 5,
    
    -- Level Difference Multipliers
    level_diff_winner_multiplier DECIMAL(4,2) DEFAULT 10.0, -- Points per level difference for winners
    level_diff_loser_penalty DECIMAL(4,2) DEFAULT 1.0,    -- Points penalty per level difference for losers
    
    -- Game Difference Bonuses
    game_diff_bonus_winner_high INTEGER DEFAULT 3,    -- Bonus for winner when diff >= 12 games
    game_diff_bonus_winner_medium INTEGER DEFAULT 2,  -- Bonus for winner when diff >= 8 games
    game_diff_bonus_winner_low INTEGER DEFAULT 1,     -- Bonus for winner when diff >= 4 games
    
    game_diff_bonus_loser_high INTEGER DEFAULT 2,     -- Bonus for loser when diff <= 4 games
    game_diff_bonus_loser_medium INTEGER DEFAULT 1,   -- Bonus for loser when diff <= 8 games
    
    -- Thresholds
    game_diff_threshold_high INTEGER DEFAULT 12,      -- High difference threshold (>= 12 games)
    game_diff_threshold_medium INTEGER DEFAULT 8,      -- Medium difference threshold (>= 8 games)
    game_diff_threshold_low INTEGER DEFAULT 4,        -- Low difference threshold (>= 4 games)
    game_diff_close_threshold INTEGER DEFAULT 4,       -- Close match threshold (<= 4 games)
    game_diff_medium_close_threshold INTEGER DEFAULT 8, -- Medium close threshold (<= 8 games)
    
    -- Additional Settings
    minimum_points_per_match INTEGER DEFAULT 1,       -- Minimum points a player can get
    maximum_points_per_match INTEGER DEFAULT 100,     -- Maximum points per match (to prevent abuse)
    enable_level_difference_bonus BOOLEAN DEFAULT true,
    enable_game_difference_bonus BOOLEAN DEFAULT true,
    
    -- Special Bonuses
    comeback_bonus INTEGER DEFAULT 5,                  -- Bonus for winning after losing first set
    tiebreak_bonus INTEGER DEFAULT 2,                  -- Bonus for winning tiebreaks
    retirement_penalty INTEGER DEFAULT -10,            -- Penalty for retiring/forfeiting
    
    -- Tournament Multipliers
    tournament_multiplier_default DECIMAL(3,2) DEFAULT 1.0,
    tournament_multiplier_championship DECIMAL(3,2) DEFAULT 1.5,
    tournament_multiplier_final DECIMAL(3,2) DEFAULT 2.0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Each club can have only one configuration
    UNIQUE(club_id)
);

-- Insert default configuration for all existing clubs
INSERT INTO ranking_configuration (club_id)
SELECT id FROM clubs
ON CONFLICT (club_id) DO NOTHING;

-- Player Ranking Table
CREATE TABLE IF NOT EXISTS player_ranking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    points DECIMAL(10,2) DEFAULT 0,
    matches_played INTEGER DEFAULT 0,
    matches_won INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Each player can have only one ranking per club
    UNIQUE(player_id, club_id)
);

-- Ranking Points History (to track all point calculations)
CREATE TABLE IF NOT EXISTS ranking_points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES intercountry_fixtures(id) ON DELETE CASCADE,
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- Match Details
    partner_id UUID REFERENCES users(id),              -- Doubles partner
    opponent1_id UUID REFERENCES users(id),
    opponent2_id UUID REFERENCES users(id),
    
    -- Categories
    player_category INTEGER,
    partner_category INTEGER,
    opponent1_category INTEGER,
    opponent2_category INTEGER,
    
    -- Match Result
    is_winner BOOLEAN,
    games_won INTEGER,
    games_lost INTEGER,
    sets_won INTEGER,
    sets_lost INTEGER,
    
    -- Point Calculation Breakdown
    base_points DECIMAL(5,2),
    level_diff_bonus DECIMAL(5,2),
    game_diff_bonus DECIMAL(5,2),
    special_bonus DECIMAL(5,2),
    tournament_multiplier DECIMAL(3,2),
    total_points DECIMAL(5,2),
    
    -- Configuration used
    config_snapshot JSONB, -- Snapshot of config used for calculation
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Points Calculation Function
CREATE OR REPLACE FUNCTION calculate_ranking_points_enhanced(
    p_match_id UUID,
    p_player_id UUID,
    p_partner_id UUID,
    p_opponent1_id UUID,
    p_opponent2_id UUID,
    p_player_category INTEGER,
    p_partner_category INTEGER,
    p_opponent1_category INTEGER,
    p_opponent2_category INTEGER,
    p_is_winner BOOLEAN,
    p_games_won INTEGER,
    p_games_lost INTEGER,
    p_sets_won INTEGER,
    p_sets_lost INTEGER,
    p_club_id UUID,
    p_tournament_type TEXT DEFAULT 'regular' -- regular, championship, final
) RETURNS DECIMAL AS $$
DECLARE
    config RECORD;
    team_avg_category DECIMAL;
    opponent_avg_category DECIMAL;
    level_difference DECIMAL;
    game_difference INTEGER;
    
    -- Point components
    base_points DECIMAL := 0;
    level_diff_points DECIMAL := 0;
    game_diff_points DECIMAL := 0;
    special_points DECIMAL := 0;
    tournament_mult DECIMAL := 1.0;
    
    total_points DECIMAL;
BEGIN
    -- Get club configuration
    SELECT * INTO config 
    FROM ranking_configuration 
    WHERE club_id = p_club_id;
    
    IF NOT FOUND THEN
        -- Use default values if no config found
        config := ROW(
            20, 5, 10.0, 1.0, 3, 2, 1, 2, 1, 12, 8, 4, 4, 8, 1, 100, true, true,
            5, 2, -10, 1.0, 1.5, 2.0, NOW(), NOW()
        );
    END IF;
    
    -- Calculate team averages
    team_avg_category := (p_player_category + p_partner_category) / 2.0;
    opponent_avg_category := (p_opponent1_category + p_opponent2_category) / 2.0;
    level_difference := ABS(team_avg_category - opponent_avg_category);
    game_difference := p_games_won - p_games_lost;
    
    -- Base points
    IF p_is_winner THEN
        base_points := config.base_points_winner;
        
        -- Level difference bonus for winners
        IF config.enable_level_difference_bonus AND team_avg_category < opponent_avg_category THEN
            level_diff_points := level_difference * config.level_diff_winner_multiplier;
        END IF;
        
        -- Game difference bonus for winners
        IF config.enable_game_difference_bonus THEN
            IF game_difference >= config.game_diff_threshold_high THEN
                game_diff_points := config.game_diff_bonus_winner_high;
            ELSIF game_difference >= config.game_diff_threshold_medium THEN
                game_diff_points := config.game_diff_bonus_winner_medium;
            ELSIF game_difference >= config.game_diff_threshold_low THEN
                game_diff_points := config.game_diff_bonus_winner_low;
            END IF;
        END IF;
        
        -- Special bonuses
        -- Comeback bonus (lost first set but won match)
        IF p_sets_lost >= 1 AND p_is_winner THEN
            special_points := special_points + config.comeback_bonus;
        END IF;
        
    ELSE -- Loser
        base_points := config.base_points_loser;
        
        -- Level difference penalty for losers
        IF config.enable_level_difference_bonus AND team_avg_category > opponent_avg_category THEN
            level_diff_points := -(level_difference * config.level_diff_loser_penalty);
        END IF;
        
        -- Game difference bonus for close matches
        IF config.enable_game_difference_bonus THEN
            IF ABS(game_difference) <= config.game_diff_close_threshold THEN
                game_diff_points := config.game_diff_bonus_loser_high;
            ELSIF ABS(game_difference) <= config.game_diff_medium_close_threshold THEN
                game_diff_points := config.game_diff_bonus_loser_medium;
            END IF;
        END IF;
    END IF;
    
    -- Tournament multiplier
    CASE p_tournament_type
        WHEN 'championship' THEN tournament_mult := config.tournament_multiplier_championship;
        WHEN 'final' THEN tournament_mult := config.tournament_multiplier_final;
        ELSE tournament_mult := config.tournament_multiplier_default;
    END CASE;
    
    -- Calculate total points
    total_points := (base_points + level_diff_points + game_diff_points + special_points) * tournament_mult;
    
    -- Apply min/max constraints
    total_points := GREATEST(config.minimum_points_per_match, 
                           LEAST(config.maximum_points_per_match, total_points));
    
    -- Save to history
    INSERT INTO ranking_points_history (
        match_id, player_id, club_id, partner_id, opponent1_id, opponent2_id,
        player_category, partner_category, opponent1_category, opponent2_category,
        is_winner, games_won, games_lost, sets_won, sets_lost,
        base_points, level_diff_bonus, game_diff_bonus, special_bonus,
        tournament_multiplier, total_points, config_snapshot
    ) VALUES (
        p_match_id, p_player_id, p_club_id, p_partner_id, p_opponent1_id, p_opponent2_id,
        p_player_category, p_partner_category, p_opponent1_category, p_opponent2_category,
        p_is_winner, p_games_won, p_games_lost, p_sets_won, p_sets_lost,
        base_points, level_diff_points, game_diff_points, special_points,
        tournament_mult, total_points,
        row_to_json(config)
    );
    
    RETURN total_points;
END;
$$ LANGUAGE plpgsql;

-- Function to update player ranking points
CREATE OR REPLACE FUNCTION update_player_ranking(
    p_player_id UUID,
    p_points DECIMAL,
    p_club_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Update or insert player ranking
    INSERT INTO player_ranking (player_id, club_id, points, last_updated)
    VALUES (p_player_id, p_club_id, p_points, NOW())
    ON CONFLICT (player_id, club_id) 
    DO UPDATE SET 
        points = player_ranking.points + p_points,
        last_updated = NOW(),
        matches_played = player_ranking.matches_played + 1,
        matches_won = CASE WHEN p_points > 15 THEN player_ranking.matches_won + 1 ELSE player_ranking.matches_won END;
END;
$$ LANGUAGE plpgsql;

-- View for ranking leaderboard
CREATE OR REPLACE VIEW ranking_leaderboard AS
SELECT 
    pr.player_id,
    pr.club_id,
    u.name,
    u.member_number,
    u.category,
    pr.points,
    pr.matches_played,
    pr.matches_won,
    CASE 
        WHEN pr.matches_played > 0 THEN 
            ROUND((pr.matches_won::DECIMAL / pr.matches_played::DECIMAL) * 100, 2)
        ELSE 0 
    END as win_percentage,
    pr.last_updated,
    c.name as club_name,
    ROW_NUMBER() OVER (PARTITION BY pr.club_id ORDER BY pr.points DESC) as club_rank,
    ROW_NUMBER() OVER (ORDER BY pr.points DESC) as global_rank
FROM player_ranking pr
JOIN users u ON pr.player_id = u.id
JOIN clubs c ON pr.club_id = c.id
WHERE pr.points > 0
ORDER BY pr.points DESC;
