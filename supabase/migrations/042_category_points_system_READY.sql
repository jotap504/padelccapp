-- ========================================
-- MIGRACIÓN: Sistema de Puntos por Categoría Mejorado
-- ========================================
-- Ejecutar este script en el editor SQL de Supabase
-- ========================================

-- Step 1: Actualizar tabla de requisitos de ascenso
ALTER TABLE category_promotion_requirements 
ADD COLUMN IF NOT EXISTS category_points_max INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS points_per_win INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS points_per_loss INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS bonus_superior_category INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS points_decay_months INTEGER DEFAULT 12;

-- Step 2: Crear tabla de puntos por categoría
CREATE TABLE IF NOT EXISTS player_category_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    current_category INTEGER NOT NULL DEFAULT 8,
    current_points INTEGER NOT NULL DEFAULT 0,
    total_matches INTEGER NOT NULL DEFAULT 0,
    total_wins INTEGER NOT NULL DEFAULT 0,
    effectiveness_rate DECIMAL(5,2) DEFAULT 0.00,
    last_match_date TIMESTAMPTZ,
    points_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, club_id)
);

-- Step 3: Crear tabla de historial de puntos por mes
CREATE TABLE IF NOT EXISTS player_monthly_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL, -- Formato: '2024-01'
    category INTEGER NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    matches_won INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, club_id, year_month)
);

-- Step 4: Crear tabla de historial de ascensos mejorada
CREATE TABLE IF NOT EXISTS promotion_history_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    from_category INTEGER NOT NULL,
    to_category INTEGER NOT NULL,
    points_at_promotion INTEGER NOT NULL,
    matches_at_promotion INTEGER NOT NULL,
    wins_at_promotion INTEGER NOT NULL,
    effectiveness_at_promotion DECIMAL(5,2),
    promotion_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Crear vista de ranking de efectividad
CREATE OR REPLACE VIEW player_effectiveness_ranking AS
SELECT 
    pcp.player_id,
    u.name as player_name,
    pcp.club_id,
    c.name as club_name,
    pcp.current_category,
    pcp.current_points,
    pcp.total_matches,
    pcp.total_wins,
    pcp.effectiveness_rate,
    RANK() OVER (PARTITION BY pcp.club_id, pcp.current_category ORDER BY pcp.effectiveness_rate DESC) as category_rank,
    RANK() OVER (PARTITION BY pcp.club_id ORDER BY pcp.effectiveness_rate DESC) as overall_rank,
    pcp.last_match_date,
    CASE 
        WHEN pcp.total_matches >= 10 THEN 'Activo'
        WHEN pcp.total_matches >= 5 THEN 'Semi-activo'
        ELSE 'Inactivo'
    END as activity_status
FROM player_category_points pcp
JOIN users u ON pcp.player_id = u.id
JOIN clubs c ON pcp.club_id = c.id
WHERE u.role != 'admin'
ORDER BY pcp.club_id, pcp.current_category, pcp.effectiveness_rate DESC;

-- Step 6: Crear función para calcular puntos actuales con decaimiento
CREATE OR REPLACE FUNCTION calculate_current_points(
    p_player_id UUID,
    p_club_id UUID
) RETURNS TABLE (
    current_points INTEGER,
    effective_matches INTEGER,
    effective_wins INTEGER,
    effectiveness_rate DECIMAL(5,2)
) AS $$
DECLARE
    v_decay_months INTEGER;
    v_cutoff_month VARCHAR(7);
    v_total_points INTEGER := 0;
    v_total_matches INTEGER := 0;
    v_total_wins INTEGER := 0;
    v_effectiveness_rate DECIMAL(5,2) := 0.00;
BEGIN
    -- Obtener configuración de decaimiento
    SELECT points_decay_months INTO v_decay_months
    FROM category_promotion_requirements 
    WHERE club_id = p_club_id 
    AND from_category = 8 
    LIMIT 1;
    
    IF v_decay_months IS NULL THEN
        v_decay_months := 12;
    END IF;
    
    -- Calcular mes de corte
    v_cutoff_month := TO_CHAR(NOW() - (v_decay_months || ' months')::INTERVAL, 'YYYY-MM');
    
    -- Sumar puntos de los últimos meses válidos
    SELECT 
        COALESCE(SUM(points_earned), 0),
        COALESCE(SUM(matches_played), 0),
        COALESCE(SUM(matches_won), 0)
    INTO v_total_points, v_total_matches, v_total_wins
    FROM player_monthly_points 
    WHERE player_id = p_player_id 
    AND club_id = p_club_id 
    AND year_month >= v_cutoff_month;
    
    -- Calcular efectividad
    IF v_total_matches > 0 THEN
        v_effectiveness_rate := (v_total_wins::DECIMAL / v_total_matches::DECIMAL) * 100;
    END IF;
    
    RETURN QUERY 
    SELECT v_total_points, v_total_matches, v_total_wins, v_effectiveness_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Crear función para añadir puntos por partido
CREATE OR REPLACE FUNCTION add_match_points(
    p_player_id UUID,
    p_club_id UUID,
    p_category INTEGER,
    p_is_win BOOLEAN,
    p_opponent_category INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_config RECORD;
    v_points_to_add INTEGER := 0;
    v_current_month VARCHAR(7);
    v_player_points RECORD;
BEGIN
    -- Obtener configuración de puntos
    SELECT * INTO v_config
    FROM category_promotion_requirements 
    WHERE club_id = p_club_id 
    AND from_category = p_category
    LIMIT 1;
    
    IF v_config IS NULL THEN
        -- Valores por defecto
        v_config.points_per_win := 20;
        v_config.points_per_loss := 5;
        v_config.bonus_superior_category := 10;
    END IF;
    
    -- Calcular puntos a añadir
    IF p_is_win THEN
        v_points_to_add := v_config.points_per_win;
        IF p_opponent_category < p_category THEN
            v_points_to_add := v_points_to_add + v_config.bonus_superior_category;
        END IF;
    ELSE
        v_points_to_add := v_config.points_per_loss;
    END IF;
    
    -- Obtener mes actual
    v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
    
    -- Actualizar o insertar puntos mensuales
    INSERT INTO player_monthly_points 
    (player_id, club_id, year_month, category, points_earned, matches_played, matches_won)
    VALUES (p_player_id, p_club_id, v_current_month, p_category, v_points_to_add, 1, CASE WHEN p_is_win THEN 1 ELSE 0 END)
    ON CONFLICT (player_id, club_id, year_month) 
    DO UPDATE SET
        points_earned = player_monthly_points.points_earned + v_points_to_add,
        matches_played = player_monthly_points.matches_played + 1,
        matches_won = player_monthly_points.matches_won + CASE WHEN p_is_win THEN 1 ELSE 0 END;
    
    -- Actualizar puntos actuales del jugador
    SELECT * INTO v_player_points
    FROM calculate_current_points(p_player_id, p_club_id);
    
    INSERT INTO player_category_points 
    (player_id, club_id, current_category, current_points, total_matches, total_wins, effectiveness_rate, last_match_date, points_updated_at)
    VALUES (p_player_id, p_club_id, p_category, v_player_points.current_points, v_player_points.effective_matches, v_player_points.effective_wins, v_player_points.effectiveness_rate, NOW(), NOW())
    ON CONFLICT (player_id, club_id) 
    DO UPDATE SET
        current_category = p_category,
        current_points = v_player_points.current_points,
        total_matches = v_player_points.effective_matches,
        total_wins = v_player_points.effective_wins,
        effectiveness_rate = v_player_points.effectiveness_rate,
        last_match_date = NOW(),
        points_updated_at = NOW();
    
    -- Verificar si cumple requisitos para ascenso
    PERFORM check_promotion_eligibility_enhanced(p_player_id, p_club_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Crear función para verificar elegibilidad de ascenso mejorada
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
    
    -- Obtener requisitos para esta categoría
    SELECT * INTO v_requirements
    FROM category_promotion_requirements
    WHERE club_id = p_club_id AND from_category = v_player_points.current_category;
    
    -- Si no hay requisitos o es la categoría más alta, no es elegible
    IF v_requirements IS NULL OR v_player_points.current_category = 1 THEN
        RETURN QUERY 
        SELECT false, v_player_points.current_category, v_player_points.current_category - 1, 
               v_player_points.current_points, 0, '{}'::jsonb, '{}'::jsonb;
    END IF;
    
    -- Verificar si cumple los requisitos de puntos
    v_eligible := v_player_points.current_points >= v_requirements.category_points_max;
    
    -- Verificar otros requisitos
    v_requirements_met := jsonb_build_object(
        'points', v_player_points.current_points >= v_requirements.category_points_max,
        'matches_won_same_level', v_player_points.effective_wins >= v_requirements.matches_won_same_level,
        'min_total_matches', v_player_points.effective_matches >= v_requirements.min_total_matches,
        'min_win_rate', v_player_points.effectiveness_rate >= v_requirements.min_win_rate
    );
    
    v_missing_requirements := jsonb_build_object(
        'points', GREATEST(0, v_requirements.category_points_max - v_player_points.current_points),
        'matches_won_same_level', GREATEST(0, v_requirements.matches_won_same_level - v_player_points.effective_wins),
        'min_total_matches', GREATEST(0, v_requirements.min_total_matches - v_player_points.effective_matches),
        'min_win_rate', GREATEST(0, v_requirements.min_win_rate - v_player_points.effectiveness_rate)
    );
    
    -- Verificar si cumple todos los requisitos
    v_eligible := (
        v_player_points.current_points >= v_requirements.category_points_max AND
        v_player_points.effective_wins >= v_requirements.matches_won_same_level AND
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

-- Step 9: Crear índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_player_category_points_player_club ON player_category_points(player_id, club_id);
CREATE INDEX IF NOT EXISTS idx_player_monthly_points_player_club_month ON player_monthly_points(player_id, club_id, year_month);
CREATE INDEX IF NOT EXISTS idx_promotion_history_enhanced_player ON promotion_history_enhanced(player_id);
CREATE INDEX IF NOT EXISTS idx_promotion_history_enhanced_club ON promotion_history_enhanced(club_id);

-- Step 10: Insertar configuración por defecto para todas las categorías
INSERT INTO category_promotion_requirements 
(club_id, from_category, matches_won_same_level, matches_won_higher_level, min_total_matches, min_win_rate, min_rating_promotion, rating_buffer, min_days_in_category, max_promotions_per_season, require_consistency, category_points_max, points_per_win, points_per_loss, bonus_superior_category, points_decay_months)
SELECT 
    '67a5b532-879c-4ae0-9b79-68f50d2f12e3' as club_id,
    category as from_category,
    CASE 
        WHEN category = 8 THEN 15
        WHEN category = 7 THEN 18
        WHEN category = 6 THEN 20
        WHEN category = 5 THEN 22
        WHEN category = 4 THEN 25
        WHEN category = 3 THEN 28
        WHEN category = 2 THEN 30
        ELSE 0
    END as matches_won_same_level,
    CASE 
        WHEN category = 8 THEN 5
        WHEN category = 7 THEN 6
        WHEN category = 6 THEN 8
        WHEN category = 5 THEN 10
        WHEN category = 4 THEN 12
        WHEN category = 3 THEN 15
        WHEN category = 2 THEN 18
        ELSE 0
    END as matches_won_higher_level,
    CASE 
        WHEN category = 8 THEN 20
        WHEN category = 7 THEN 25
        WHEN category = 6 THEN 30
        WHEN category = 5 THEN 35
        WHEN category = 4 THEN 40
        WHEN category = 3 THEN 45
        WHEN category = 2 THEN 50
        ELSE 0
    END as min_total_matches,
    CASE 
        WHEN category = 8 THEN 55.0
        WHEN category = 7 THEN 58.0
        WHEN category = 6 THEN 60.0
        WHEN category = 5 THEN 62.0
        WHEN category = 4 THEN 65.0
        WHEN category = 3 THEN 68.0
        WHEN category = 2 THEN 70.0
        ELSE 0.0
    END as min_win_rate,
    0 as min_rating_promotion,
    0 as rating_buffer,
    30 as min_days_in_category,
    2 as max_promotions_per_season,
    true as require_consistency,
    500 as category_points_max,
    20 as points_per_win,
    5 as points_per_loss,
    10 as bonus_superior_category,
    12 as points_decay_months
FROM generate_series(2, 8) as category
ON CONFLICT (club_id, from_category) DO NOTHING;

-- ========================================
-- VERIFICACIÓN: Ejecutar estas consultas para verificar que todo se creó correctamente
-- ========================================

-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('player_category_points', 'player_monthly_points', 'promotion_history_enhanced');

-- Verificar columnas nuevas en category_promotion_requirements
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'category_promotion_requirements' 
AND column_name LIKE '%points%';

-- Verificar funciones creadas
SELECT proname FROM pg_proc WHERE proname IN ('calculate_current_points', 'add_match_points', 'check_promotion_eligibility_enhanced');

-- Verificar configuración insertada
SELECT from_category, category_points_max, points_per_win, points_per_loss, bonus_superior_category, points_decay_months
FROM category_promotion_requirements 
WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3'
ORDER BY from_category DESC;

-- ========================================
-- FIN DE LA MIGRACIÓN
-- ========================================
