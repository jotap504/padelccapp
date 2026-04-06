-- ============================================
-- SISTEMA DE LIGAS POR NIVELES
-- ============================================

-- Tabla de ligas
CREATE TABLE IF NOT EXISTS leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- Información básica
    name TEXT NOT NULL,
    description TEXT,
    season TEXT NOT NULL, -- Ej: "2024", "Verano 2024", etc.
    
    -- Categoría de la liga
    category INTEGER NOT NULL CHECK (category BETWEEN 1 AND 8),
    
    -- Formato
    format TEXT DEFAULT 'round_robin' CHECK (format IN ('round_robin', 'single_elimination', 'double_elimination', 'swiss')),
    
    -- Estado
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'registration', 'active', 'finished', 'cancelled')),
    
    -- Fechas
    registration_start_date DATE,
    registration_end_date DATE,
    start_date DATE,
    end_date DATE,
    
    -- Configuración
    max_participants INTEGER DEFAULT 16,
    min_participants INTEGER DEFAULT 4,
    match_format TEXT DEFAULT 'best_of_3_sets', -- best_of_3_sets, best_of_5_sets, single_set
    
    -- Puntos por posición (para ligas tipo "todos contra todos")
    points_per_win INTEGER DEFAULT 3,
    points_per_draw INTEGER DEFAULT 1,
    points_per_loss INTEGER DEFAULT 0,
    
    -- Premios
    prizes JSONB, -- [{position: 1, prize: "Trofeo + $500"}, ...]
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de participantes de la liga
CREATE TABLE IF NOT EXISTS league_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    
    -- Puede ser un jugador individual o un equipo
    user_id UUID REFERENCES users(id), -- Si es individual
    team_name TEXT, -- Si es por equipos
    
    -- Estado
    status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'withdrawn', 'disqualified')),
    
    -- Estadísticas
    matches_played INTEGER DEFAULT 0,
    matches_won INTEGER DEFAULT 0,
    matches_drawn INTEGER DEFAULT 0,
    matches_lost INTEGER DEFAULT 0,
    sets_won INTEGER DEFAULT 0,
    sets_lost INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0, -- Puntos en la tabla
    position INTEGER, -- Posición en la tabla
    
    -- Metadata
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    seed_number INTEGER, -- Número de cabeza de serie
    
    UNIQUE(league_id, user_id)
);

-- Tabla de fechas/jornadas de la liga
CREATE TABLE IF NOT EXISTS league_fixtures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    
    -- Información de la fecha
    round_number INTEGER NOT NULL, -- Fecha 1, Fecha 2, etc.
    round_name TEXT, -- "Fecha 1", "Semifinales", "Final", etc.
    
    -- Fechas límite para jugar
    start_date DATE,
    end_date DATE,
    
    -- Estado
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de partidos de la liga
CREATE TABLE IF NOT EXISTS league_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    fixture_id UUID REFERENCES league_fixtures(id),
    
    -- Participantes
    participant_a_id UUID NOT NULL REFERENCES league_participants(id),
    participant_b_id UUID NOT NULL REFERENCES league_participants(id),
    
    -- Resultado
    score_a INTEGER, -- Sets ganados o puntos
    score_b INTEGER,
    
    -- Detalle de sets (si aplica)
    sets JSONB, -- [{games_a: 6, games_b: 4}, ...]
    
    -- Estado
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'walkover_a', 'walkover_b', 'postponed', 'cancelled')),
    
    -- Cancha reservada
    court_id UUID REFERENCES courts(id),
    court_booking_id UUID REFERENCES court_bookings(id),
    
    -- Fecha y hora
    scheduled_date DATE,
    scheduled_time TIME,
    
    -- Fecha real de juego
    played_at TIMESTAMPTZ,
    
    -- Notas
    notes TEXT,
    
    -- Referencia al partido del sistema general (si se sincroniza)
    match_id UUID REFERENCES matches(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Evitar duplicados
    UNIQUE(league_id, fixture_id, participant_a_id, participant_b_id)
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_leagues_club ON leagues(club_id);
CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status);
CREATE INDEX IF NOT EXISTS idx_leagues_season ON leagues(season);
CREATE INDEX IF NOT EXISTS idx_leagues_category ON leagues(category);

CREATE INDEX IF NOT EXISTS idx_league_participants_league ON league_participants(league_id);
CREATE INDEX IF NOT EXISTS idx_league_participants_user ON league_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_league_participants_points ON league_participants(league_id, points DESC);

CREATE INDEX IF NOT EXISTS idx_league_fixtures_league ON league_fixtures(league_id);
CREATE INDEX IF NOT EXISTS idx_league_fixtures_round ON league_fixtures(round_number);

CREATE INDEX IF NOT EXISTS idx_league_matches_league ON league_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_fixture ON league_matches(fixture_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_status ON league_matches(status);

-- ============================================
-- VISTAS
-- ============================================

-- Vista de tabla de posiciones
CREATE VIEW league_standings AS
SELECT 
    lp.id,
    lp.league_id,
    lp.user_id,
    u.name as participant_name,
    lp.team_name,
    lp.matches_played,
    lp.matches_won,
    lp.matches_drawn,
    lp.matches_lost,
    lp.sets_won,
    lp.sets_lost,
    lp.games_won,
    lp.games_lost,
    lp.points,
    lp.position,
    -- Cálculo de sets y games diff
    lp.sets_won - lp.sets_lost as sets_diff,
    lp.games_won - lp.games_lost as games_diff,
    -- Cálculo de efectividad
    CASE 
        WHEN lp.matches_played > 0 THEN ROUND((lp.points::decimal / (lp.matches_played * 3)) * 100, 2)
        ELSE 0
    END as effectiveness
FROM league_participants lp
LEFT JOIN users u ON lp.user_id = u.id
WHERE lp.status IN ('registered', 'confirmed')
ORDER BY lp.league_id, lp.points DESC, sets_diff DESC, games_diff DESC;

-- ============================================
-- FUNCIONES
-- ============================================

-- Función para inscribir participante
CREATE OR REPLACE FUNCTION register_league_participant(
    p_league_id UUID,
    p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    league_category INTEGER;
    user_category INTEGER;
BEGIN
    -- Verificar que el usuario no esté ya inscripto
    IF EXISTS (SELECT 1 FROM league_participants WHERE league_id = p_league_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'El jugador ya está inscripto en esta liga';
    END IF;
    
    -- Obtener categoría de la liga
    SELECT category INTO league_category FROM leagues WHERE id = p_league_id;
    
    -- Obtener categoría del usuario
    SELECT category INTO user_category FROM users WHERE id = p_user_id;
    
    -- Verificar que coincida la categoría (con +/- 1 de tolerancia)
    IF ABS(user_category - league_category) > 1 THEN
        RAISE EXCEPTION 'La categoría del jugador no es compatible con esta liga';
    END IF;
    
    -- Crear inscripción
    INSERT INTO league_participants (league_id, user_id)
    VALUES (p_league_id, p_user_id)
    RETURNING id INTO new_id;
    
    -- Notificar
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (
        p_user_id,
        'general',
        'Inscripción Confirmada',
        'Te has inscripto correctamente en la liga'
    );
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Función para generar fixture (todos contra todos)
CREATE OR REPLACE FUNCTION generate_round_robin_fixture(p_league_id UUID)
RETURNS INTEGER AS $$
DECLARE
    participants UUID[];
    n INTEGER;
    rounds INTEGER;
    i INTEGER;
    j INTEGER;
    round_num INTEGER := 1;
    fixture_id UUID;
    p_a UUID;
    p_b UUID;
BEGIN
    -- Obtener participantes
    SELECT ARRAY_AGG(user_id ORDER BY seed_number NULLS LAST, registered_at)
    INTO participants
    FROM league_participants
    WHERE league_id = p_league_id AND status IN ('registered', 'confirmed');
    
    n := array_length(participants, 1);
    
    IF n < 2 THEN
        RAISE EXCEPTION 'Se necesitan al menos 2 participantes';
    END IF;
    
    -- Calcular número de fechas
    IF n % 2 = 0 THEN
        rounds := n - 1;
    ELSE
        rounds := n;
        participants := array_append(participants, NULL); -- Agregar "bye"
    END IF;
    
    -- Generar fixture (algoritmo circle method)
    FOR round_num IN 1..rounds LOOP
        -- Crear fecha
        INSERT INTO league_fixtures (league_id, round_number, round_name)
        VALUES (p_league_id, round_num, 'Fecha ' || round_num)
        RETURNING id INTO fixture_id;
        
        -- Generar partidos de esta fecha
        FOR i IN 1..(n/2) LOOP
            p_a := participants[i];
            p_b := participants[n - i + 1];
            
            IF p_a IS NOT NULL AND p_b IS NOT NULL THEN
                INSERT INTO league_matches (league_id, fixture_id, participant_a_id, participant_b_id)
                SELECT 
                    p_league_id,
                    fixture_id,
                    lp_a.id,
                    lp_b.id
                FROM league_participants lp_a
                JOIN league_participants lp_b ON lp_b.league_id = p_league_id
                WHERE lp_a.user_id = p_a AND lp_b.user_id = p_b;
            END IF;
        END LOOP;
        
        -- Rotar participantes (manteniendo el primero fijo)
        participants := ARRAY[
            participants[1],
            participants[n],
            participants[2:n-1]
        ];
    END LOOP;
    
    RETURN rounds;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar tabla de posiciones
CREATE OR REPLACE FUNCTION update_league_standings(p_league_id UUID)
RETURNS void AS $$
BEGIN
    -- Actualizar estadísticas de cada participante
    UPDATE league_participants lp
    SET
        matches_played = sub.matches_played,
        matches_won = sub.matches_won,
        matches_drawn = sub.matches_drawn,
        matches_lost = sub.matches_lost,
        sets_won = sub.sets_won,
        sets_lost = sub.sets_lost,
        games_won = sub.games_won,
        games_lost = sub.games_lost,
        points = sub.points
    FROM (
        SELECT 
            id,
            COUNT(*) FILTER (WHERE status = 'completed') as matches_played,
            COUNT(*) FILTER (WHERE status = 'completed' AND 
                (participant_a_id = id AND score_a > score_b) OR 
                (participant_b_id = id AND score_b > score_a)
            ) as matches_won,
            COUNT(*) FILTER (WHERE status = 'completed' AND score_a = score_b) as matches_drawn,
            COUNT(*) FILTER (WHERE status = 'completed' AND 
                (participant_a_id = id AND score_a < score_b) OR 
                (participant_b_id = id AND score_b < score_a)
            ) as matches_lost,
            COALESCE(SUM(sets_won), 0) as sets_won,
            COALESCE(SUM(sets_lost), 0) as sets_lost,
            COALESCE(SUM(games_won), 0) as games_won,
            COALESCE(SUM(games_lost), 0) as games_lost,
            COALESCE(SUM(points), 0) as points
        FROM (
            SELECT 
                lp.id,
                lm.status,
                CASE WHEN lp.id = lm.participant_a_id THEN lm.score_a ELSE lm.score_b END as score_a,
                CASE WHEN lp.id = lm.participant_a_id THEN lm.score_b ELSE lm.score_a END as score_b,
                CASE WHEN lp.id = lm.participant_a_id THEN 
                    (SELECT COUNT(*) FROM jsonb_array_elements(lm.sets) s WHERE (s->>'games_a')::int > (s->>'games_b')::int)
                ELSE 
                    (SELECT COUNT(*) FROM jsonb_array_elements(lm.sets) s WHERE (s->>'games_b')::int > (s->>'games_a')::int)
                END as sets_won,
                CASE WHEN lp.id = lm.participant_a_id THEN 
                    (SELECT COUNT(*) FROM jsonb_array_elements(lm.sets) s WHERE (s->>'games_a')::int < (s->>'games_b')::int)
                ELSE 
                    (SELECT COUNT(*) FROM jsonb_array_elements(lm.sets) s WHERE (s->>'games_b')::int < (s->>'games_a')::int)
                END as sets_lost,
                CASE WHEN lp.id = lm.participant_a_id THEN 
                    (SELECT COALESCE(SUM((s->>'games_a')::int), 0) FROM jsonb_array_elements(lm.sets) s)
                ELSE 
                    (SELECT COALESCE(SUM((s->>'games_b')::int), 0) FROM jsonb_array_elements(lm.sets) s)
                END as games_won,
                CASE WHEN lp.id = lm.participant_a_id THEN 
                    (SELECT COALESCE(SUM((s->>'games_b')::int), 0) FROM jsonb_array_elements(lm.sets) s)
                ELSE 
                    (SELECT COALESCE(SUM((s->>'games_a')::int), 0) FROM jsonb_array_elements(lm.sets) s)
                END as games_lost,
                CASE 
                    WHEN lp.id = lm.participant_a_id AND lm.score_a > lm.score_b THEN l.points_per_win
                    WHEN lp.id = lm.participant_b_id AND lm.score_b > lm.score_a THEN l.points_per_win
                    WHEN lm.score_a = lm.score_b THEN l.points_per_draw
                    ELSE l.points_per_loss
                END as points
            FROM league_participants lp
            LEFT JOIN league_matches lm ON (lp.id = lm.participant_a_id OR lp.id = lm.participant_b_id)
            JOIN leagues l ON l.id = lp.league_id
            WHERE lp.league_id = p_league_id
        ) stats
        GROUP BY id
    ) sub
    WHERE lp.id = sub.id;
    
    -- Actualizar posiciones
    UPDATE league_participants
    SET position = sub.position
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                ORDER BY points DESC, 
                         (sets_won - sets_lost) DESC, 
                         (games_won - games_lost) DESC
            ) as position
        FROM league_participants
        WHERE league_id = p_league_id
    ) sub
    WHERE league_participants.id = sub.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_league_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_league_timestamp ON leagues;
CREATE TRIGGER update_league_timestamp
    BEFORE UPDATE ON leagues
    FOR EACH ROW EXECUTE FUNCTION update_league_timestamp();

DROP TRIGGER IF EXISTS update_league_match_timestamp ON league_matches;
CREATE TRIGGER update_league_match_timestamp
    BEFORE UPDATE ON league_matches
    FOR EACH ROW EXECUTE FUNCTION update_league_timestamp();

-- Trigger para actualizar standings al completar partido
CREATE OR REPLACE FUNCTION update_standings_on_match_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        PERFORM update_league_standings(NEW.league_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_standings_on_match_complete ON league_matches;
CREATE TRIGGER update_standings_on_match_complete
    AFTER UPDATE ON league_matches
    FOR EACH ROW EXECUTE FUNCTION update_standings_on_match_complete();

-- ============================================
-- DATOS DE PRUEBA
-- ============================================

-- Insertar ligas de ejemplo
INSERT INTO leagues (club_id, name, season, category, status, max_participants, created_by)
SELECT 
    c.id,
    'Liga ' || cat || '° Categoría ' || c.name,
    '2024',
    cat,
    'registration',
    16,
    (SELECT id FROM users WHERE club_id = c.id LIMIT 1)
FROM clubs c
CROSS JOIN generate_series(4, 6) as cat
WHERE EXISTS (SELECT 1 FROM users WHERE club_id = c.id)
LIMIT 3;
