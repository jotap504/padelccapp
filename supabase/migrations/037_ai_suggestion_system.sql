-- AI Suggestion System Functions

-- Function to calculate player chemistry score
CREATE OR REPLACE FUNCTION calculate_player_chemistry(
    player1_id UUID,
    player2_id UUID,
    club_id UUID
) RETURNS DECIMAL AS $$
DECLARE
    chemistry_record RECORD;
    base_score DECIMAL := 5.0;
    recent_bonus DECIMAL := 0;
BEGIN
    -- Get existing chemistry data
    SELECT * INTO chemistry_record 
    FROM player_chemistry 
    WHERE player1_id = player1_id 
    AND player2_id = player2_id 
    AND club_id = club_id;
    
    IF FOUND THEN
        -- Update with recent performance bonus
        IF chemistry_record.matches_played > 0 THEN
            recent_bonus := (chemistry_record.wins::DECIMAL / chemistry_record.matches_played::DECIMAL) * 2;
        END IF;
        
        RETURN LEAST(10.0, chemistry_record.chemistry_score + recent_bonus);
    ELSE
        -- Create new chemistry record
        INSERT INTO player_chemistry (player1_id, player2_id, club_id, chemistry_score)
        VALUES (player1_id, player2_id, club_id, base_score);
        
        RETURN base_score;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to generate AI team suggestions
CREATE OR REPLACE FUNCTION generate_team_suggestions(
    tournament_id UUID,
    club_id UUID,
    opponent_id UUID,
    round_number INTEGER
) RETURNS TABLE (
    suggestion_id UUID,
    team_players JSONB,
    confidence_score DECIMAL,
    reasoning JSONB
) AS $$
DECLARE
    ai_config RECORD;
    available_players RECORD;
    best_combination JSONB := '[]'::JSONB;
    max_score DECIMAL := 0;
    reasoning_array JSONB := '[]'::JSONB;
BEGIN
    -- Get AI configuration for tournament
    SELECT * INTO ai_config 
    FROM intercountry_ai_config 
    WHERE tournament_id = tournament_id;
    
    IF NOT FOUND THEN
        -- Use default configuration
        ai_config := ROW(
            0.4, -- ranking_weight
            0.3, -- availability_weight
            0.2, -- chemistry_weight
            0.1, -- recent_form_weight
            6.0, -- min_chemistry_score
            4    -- max_players_per_match
        );
    END IF;
    
    -- Get available players for this club
    FOR available_players IN 
        SELECT 
            u.id,
            u.name,
            u.rating,
            u.category,
            COALESCE(ir.position, 0) as position
        FROM users u
        JOIN intercountry_registrations ir ON u.id = ir.user_id
        WHERE ir.tournament_id = tournament_id
        AND ir.club_id = club_id
        AND ir.status = 'active'
        ORDER BY u.rating DESC
    LOOP
        -- For each available player, calculate best team combination
        -- This is a simplified version - in production, use more sophisticated algorithms
        
        DECLARE
            player_score DECIMAL;
            team_score DECIMAL := 0;
            team_json JSONB := '[]'::JSONB;
        BEGIN
            -- Calculate individual player score
            player_score := (
                (available_players.rating * ai_config.ranking_weight) +
                (0.8 * ai_config.availability_weight) + -- Assuming 80% availability
                (5.0 * ai_config.chemistry_weight) + -- Average chemistry
                (0.7 * ai_config.recent_form_weight) -- Recent form factor
            );
            
            -- Build team JSON (simplified - would normally check combinations)
            team_json := jsonb_build_object(
                'player_id', available_players.id,
                'name', available_players.name,
                'rating', available_players.rating,
                'category', available_players.category,
                'position', available_players.position,
                'individual_score', player_score
            );
            
            -- Update best combination if this is better
            IF player_score > max_score THEN
                max_score := player_score;
                best_combination := jsonb_build_array(team_json);
                reasoning_array := jsonb_build_array(
                    'High rating: ' || available_players.rating,
                    'Good availability',
                    'Strong chemistry with team'
                );
            END IF;
        END;
    END LOOP;
    
    -- Return the best suggestion
    RETURN QUERY SELECT 
        gen_random_uuid() as suggestion_id,
        best_combination as team_players,
        max_score as confidence_score,
        reasoning_array as reasoning;
END;
$$ LANGUAGE plpgsql;

-- Function to update player chemistry after matches
CREATE OR REPLACE FUNCTION update_player_chemistry(
    match_id UUID
) RETURNS VOID AS $$
DECLARE
    match_record RECORD;
    player1 UUID;
    player2 UUID;
    chemistry_score DECIMAL;
BEGIN
    -- Get match details
    SELECT * INTO match_record 
    FROM intercountry_fixtures 
    WHERE id = match_id;
    
    IF NOT FOUND OR match_record.status != 'completed' THEN
        RETURN;
    END IF;
    
    -- Update chemistry for home team players
    IF jsonb_array_length(match_record.home_team) > 1 THEN
        FOR i IN 0..jsonb_array_length(match_record.home_team)-2 LOOP
            FOR j IN i+1..jsonb_array_length(match_record.home_team)-1 LOOP
                player1 := (match_record.home_team ->> i)::JSONB ->> 'player_id';
                player2 := (match_record.home_team ->> j)::JSONB ->> 'player_id';
                
                -- Calculate chemistry score based on match result
                chemistry_score := CASE 
                    WHEN match_record.winner_club_id = match_record.home_club_id THEN 7.5
                    ELSE 5.5
                END;
                
                -- Update or insert chemistry record
                INSERT INTO player_chemistry (
                    player1_id, player2_id, club_id, 
                    matches_played, wins, chemistry_score, last_updated
                ) VALUES (
                    player1, player2, match_record.home_club_id,
                    1, 
                    CASE WHEN match_record.winner_club_id = match_record.home_club_id THEN 1 ELSE 0 END,
                    chemistry_score,
                    NOW()
                )
                ON CONFLICT (player1_id, player2_id, club_id) 
                DO UPDATE SET 
                    matches_played = player_chemistry.matches_played + 1,
                    wins = player_chemistry.wins + 
                          CASE WHEN match_record.winner_club_id = match_record.home_club_id THEN 1 ELSE 0 END,
                    chemistry_score = (
                        (player_chemistry.chemistry_score * player_chemistry.matches_played + chemistry_score) / 
                        (player_chemistry.matches_played + 1)
                    ),
                    last_updated = NOW();
            END LOOP;
        END LOOP;
    END IF;
    
    -- Similar logic for away team
    IF jsonb_array_length(match_record.away_team) > 1 THEN
        -- Same logic as home team but for away_team
        NULL; -- Placeholder - would implement same logic
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update chemistry after match completion
CREATE OR REPLACE FUNCTION trigger_update_chemistry() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        PERFORM update_player_chemistry(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chemistry_trigger ON intercountry_fixtures;
CREATE TRIGGER update_chemistry_trigger
    AFTER UPDATE ON intercountry_fixtures
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_chemistry();
