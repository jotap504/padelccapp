-- Add matches_won_higher_level requirement to promotion eligibility check

-- First, let's check how the function calculate_current_points works to understand the data structure
-- We need to calculate wins against higher category opponents

-- Update the check_promotion_eligibility_enhanced function to include matches_won_higher_level
CREATE OR REPLACE FUNCTION check_promotion_eligibility_enhanced(
    p_player_id UUID,
    p_club_id UUID
) RETURNS TABLE (
    eligible BOOLEAN,
    from_category INTEGER,
    to_category INTEGER,
    current_points INTEGER,
    points_needed INTEGER,
    requirements_met JSONB,
    missing_requirements JSONB
) AS $$
DECLARE
    v_player_points RECORD;
    v_requirements RECORD;
    v_eligible BOOLEAN := false;
    v_requirements_met JSONB := '{}';
    v_missing_requirements JSONB := '{}';
    v_wins_higher_level INTEGER := 0;
BEGIN
    -- Obtener puntos actuales del jugador
    SELECT * INTO v_player_points
    FROM calculate_current_points(p_player_id, p_club_id);
    
    -- Obtener categoría actual del jugador
    SELECT current_category INTO v_player_points.current_category
    FROM player_category_points
    WHERE player_id = p_player_id AND club_id = p_club_id;
    
    -- Si no tiene categoría, asignar la más baja
    IF v_player_points.current_category IS NULL THEN
        v_player_points.current_category := 8;
    END IF;
    
    -- Obtener requisitos de ascenso para la categoría actual
    SELECT * INTO v_requirements
    FROM category_promotion_requirements
    WHERE from_category = v_player_points.current_category AND club_id = p_club_id;
    
    -- Si no hay requisitos, usar valores por defecto
    IF NOT FOUND THEN
        v_requirements.category_points_max := 500;
        v_requirements.matches_won_same_level := 20;
        v_requirements.matches_won_higher_level := 5;
        v_requirements.min_total_matches := 30;
        v_requirements.min_win_rate := 60.0;
    END IF;
    
    -- Calcular victorias vs categorías superiores
    -- Buscar partidos donde el jugador ganó contra oponentes de categoría superior
    SELECT COUNT(DISTINCT m.id) INTO v_wins_higher_level
    FROM matches m
    CROSS JOIN LATERAL jsonb_array_elements(m.team_a) AS player_a
    CROSS JOIN LATERAL jsonb_array_elements(m.team_b) AS player_b
    WHERE m.status = 'confirmed'
      AND (
          -- Jugador está en team_a y ganó
          (player_a->>'user_id' = p_player_id AND 
           EXISTS (
               SELECT 1 FROM jsonb_array_elements(m.sets) AS s
               WHERE (s->>'team_a')::int > (s->>'team_b')::int
           )
          ) OR
          -- Jugador está en team_b y ganó
          (player_b->>'user_id' = p_player_id AND 
           EXISTS (
               SELECT 1 FROM jsonb_array_elements(m.sets) AS s
               WHERE (s->>'team_b')::int > (s->>'team_a')::int
           )
          )
      )
      AND EXISTS (
          -- Verificar que al menos un oponente tenía categoría superior
          SELECT 1 
          FROM jsonb_array_elements(
              CASE 
                  WHEN player_a->>'user_id' = p_player_id THEN m.team_b
                  ELSE m.team_a
              END
          ) AS opponent
          JOIN users u ON u.id = (opponent->>'user_id')::uuid
          JOIN player_category_points pcp ON pcp.player_id = u.id AND pcp.club_id = p_club_id
          WHERE pcp.current_category < v_player_points.current_category
      );
    
    -- Construir JSON de requisitos cumplidos
    v_requirements_met := jsonb_build_object(
        'points', v_player_points.current_points >= v_requirements.category_points_max,
        'matches_won_same_level', v_player_points.effective_wins >= v_requirements.matches_won_same_level,
        'matches_won_higher_level', v_wins_higher_level >= v_requirements.matches_won_higher_level,
        'min_total_matches', v_player_points.effective_matches >= v_requirements.min_total_matches,
        'min_win_rate', v_player_points.effectiveness_rate >= v_requirements.min_win_rate
    );
    
    -- Construir JSON de requisitos faltantes
    v_missing_requirements := jsonb_build_object(
        'points', GREATEST(0, v_requirements.category_points_max - v_player_points.current_points),
        'matches_won_same_level', GREATEST(0, v_requirements.matches_won_same_level - v_player_points.effective_wins),
        'matches_won_higher_level', GREATEST(0, v_requirements.matches_won_higher_level - v_wins_higher_level),
        'min_total_matches', GREATEST(0, v_requirements.min_total_matches - v_player_points.effective_matches),
        'min_win_rate', GREATEST(0, v_requirements.min_win_rate - v_player_points.effectiveness_rate)
    );
    
    -- Verificar si cumple todos los requisitos
    v_eligible := (
        v_player_points.current_points >= v_requirements.category_points_max AND
        v_player_points.effective_wins >= v_requirements.matches_won_same_level AND
        v_wins_higher_level >= v_requirements.matches_won_higher_level AND
        v_player_points.effective_matches >= v_requirements.min_total_matches AND
        v_player_points.effectiveness_rate >= v_requirements.min_win_rate
    );
    
    RETURN QUERY 
    SELECT 
        v_eligible,
        v_player_points.current_category,
        v_player_points.current_category - 1,
        v_player_points.current_points,
        v_requirements.category_points_max,
        v_requirements_met,
        v_missing_requirements;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
