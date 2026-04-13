-- Agregar cálculo automático de puntos cuando se confirma un partido
-- Este trigger calcula los puntos según la configuración del club

CREATE OR REPLACE FUNCTION public.calculate_match_points()
RETURNS TRIGGER AS $$
DECLARE
    config RECORD;
    games_a INT := 0;
    games_b INT := 0;
    sets_a INT := 0;
    sets_b INT := 0;
    team_a_won BOOLEAN;
    player_elem RECORD;
    player_id UUID;
    player_cat INT;
    avg_cat_a NUMERIC := 0;
    avg_cat_b NUMERIC := 0;
    cat_diff NUMERIC;
    game_diff INT;
    points_per_win INT;
    points_per_loss INT;
    points_game_diff NUMERIC;
    cat_bonus_percent INT;
    points_a NUMERIC := 0;
    points_b NUMERIC := 0;
    player_count_a INT := 0;
    player_count_b INT := 0;
BEGIN
    -- Solo procesar si el partido fue confirmado
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        
        -- Obtener configuración del club
        SELECT * INTO config FROM club_point_configs WHERE club_id = NEW.club_id LIMIT 1;
        
        -- Si no hay configuración, usar valores por defecto
        IF NOT FOUND THEN
            config.points_per_win := 20;
            config.points_per_loss := 0;
            config.points_per_game_diff := 0.5;
            config.category_bonus_percent := 10;
            config.category_penalty_percent := 0;
            config.max_points_per_match := 50;
        END IF;
        
        -- Calcular games y sets ganados
        FOR i IN 1..jsonb_array_length(NEW.sets) LOOP
            games_a := games_a + COALESCE((NEW.sets[i]->>'team_a')::INT, 0);
            games_b := games_b + COALESCE((NEW.sets[i]->>'team_b')::INT, 0);

            IF COALESCE((NEW.sets[i]->>'team_a')::INT, 0) > COALESCE((NEW.sets[i]->>'team_b')::INT, 0) THEN
                sets_a := sets_a + 1;
            ELSIF COALESCE((NEW.sets[i]->>'team_b')::INT, 0) > COALESCE((NEW.sets[i]->>'team_a')::INT, 0) THEN
                sets_b := sets_b + 1;
            END IF;
        END LOOP;
        
        team_a_won := sets_a > sets_b;
        game_diff := ABS(games_a - games_b);
        points_game_diff := game_diff * COALESCE(config.points_per_game_diff, 0.5);
        
        -- Calcular categoría promedio de cada equipo
        FOR player_elem IN 
            SELECT (elem->>'user_id')::text::UUID as uid,
                   COALESCE((SELECT category FROM users WHERE id = (elem->>'user_id')::text::UUID), 5) as cat
            FROM jsonb_array_elements(NEW.team_a) AS elem
        LOOP
            avg_cat_a := avg_cat_a + player_elem.cat;
            player_count_a := player_count_a + 1;
        END LOOP;
        
        FOR player_elem IN 
            SELECT (elem->>'user_id')::text::UUID as uid,
                   COALESCE((SELECT category FROM users WHERE id = (elem->>'user_id')::text::UUID), 5) as cat
            FROM jsonb_array_elements(NEW.team_b) AS elem
        LOOP
            avg_cat_b := avg_cat_b + player_elem.cat;
            player_count_b := player_count_b + 1;
        END LOOP;
        
        IF player_count_a > 0 THEN
            avg_cat_a := avg_cat_a / player_count_a;
        END IF;
        IF player_count_b > 0 THEN
            avg_cat_b := avg_cat_b / player_count_b;
        END IF;
        
        cat_diff := avg_cat_b - avg_cat_a;  -- Positivo si B es mejor (número menor), negativo si A es mejor
        
        -- Calcular puntos base
        IF team_a_won THEN
            points_a := COALESCE(config.points_per_win, 20) + points_game_diff;
            points_b := -COALESCE(config.points_per_loss, 0) - points_game_diff;
            
            -- Bonus por ganar a categoría superior (B es mejor si cat_diff < 0)
            IF cat_diff < 0 THEN
                points_a := points_a + (ABS(cat_diff) * COALESCE(config.category_bonus_percent, 10) / 100 * points_a);
            END IF;
        ELSE
            points_a := -COALESCE(config.points_per_loss, 0) - points_game_diff;
            points_b := COALESCE(config.points_per_win, 20) + points_game_diff;
            
            -- Bonus por ganar a categoría superior (A es mejor si cat_diff > 0)
            IF cat_diff > 0 THEN
                points_b := points_b + (cat_diff * COALESCE(config.category_bonus_percent, 10) / 100 * points_b);
            END IF;
        END IF;
        
        -- Aplicar límites
        points_a := GREATEST(-COALESCE(config.max_points_per_match, 50), LEAST(COALESCE(config.max_points_per_match, 50), points_a));
        points_b := GREATEST(-COALESCE(config.max_points_per_match, 50), LEAST(COALESCE(config.max_points_per_match, 50), points_b));
        
        -- Actualizar puntos de jugadores del equipo A
        FOR player_elem IN 
            SELECT (elem->>'user_id')::text::UUID as uid
            FROM jsonb_array_elements(NEW.team_a) AS elem
        LOOP
            UPDATE users 
            SET rating = GREATEST(0, LEAST(500, COALESCE(rating, 0) + points_a))
            WHERE id = player_elem.uid;
        END LOOP;
        
        -- Actualizar puntos de jugadores del equipo B
        FOR player_elem IN 
            SELECT (elem->>'user_id')::text::UUID as uid
            FROM jsonb_array_elements(NEW.team_b) AS elem
        LOOP
            UPDATE users 
            SET rating = GREATEST(0, LEAST(500, COALESCE(rating, 0) + points_b))
            WHERE id = player_elem.uid;
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para calcular puntos al confirmar partido
DROP TRIGGER IF EXISTS calculate_points_on_match_confirmation ON matches;
CREATE TRIGGER calculate_points_on_match_confirmation
    AFTER UPDATE ON matches
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_match_points();

-- También agregar al trigger existente de estadísticas para no romper compatibilidad
-- Asegurarnos de que el trigger anterior siga funcionando
COMMENT ON FUNCTION public.calculate_match_points() IS 'Calcula puntos acumulativos para jugadores cuando se confirma un partido';
