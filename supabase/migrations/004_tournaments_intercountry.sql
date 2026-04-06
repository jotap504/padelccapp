-- ============================================
-- SISTEMA DE TORNEOS E INTERCOUNTRYS
-- ============================================

-- Tabla de torneos locales
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('single_elimination', 'double_elimination', 'round_robin', 'swiss')),
    category INTEGER CHECK (category BETWEEN 1 AND 8),
    max_participants INTEGER NOT NULL DEFAULT 16,
    registration_start_date TIMESTAMPTZ NOT NULL,
    registration_end_date TIMESTAMPTZ NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration_open', 'registration_closed', 'in_progress', 'finished', 'cancelled')),
    registration_fee DECIMAL(10,2) DEFAULT 0,
    prize_pool JSONB,
    rules TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de inscripciones a torneos
CREATE TABLE IF NOT EXISTS tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'withdrawn')),
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    payment_method TEXT,
    seed INTEGER,
    UNIQUE(tournament_id, user_id)
);

-- Tabla de partidos de torneo (bracket)
CREATE TABLE IF NOT EXISTS tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    bracket_position TEXT NOT NULL, -- ej: "R1-M1", "R2-M1", "SF-1", "F"
    team_a JSONB, -- [{user_id, name}, {user_id, name}] para dobles
    team_b JSONB,
    winner_team TEXT CHECK (winner_team IN ('A', 'B')),
    sets JSONB, -- [{games_a, games_b}, ...]
    scheduled_date TIMESTAMPTZ,
    court_number INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'bye')),
    next_match_id UUID REFERENCES tournament_matches(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SISTEMA DE INTERCOUNTRYS
-- ============================================

-- Tabla de torneos intercountry
CREATE TABLE IF NOT EXISTS intercountry_tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    season INTEGER NOT NULL, -- ej: 2024
    type TEXT NOT NULL CHECK (type IN ('league', 'cup', 'supercup')),
    category INTEGER CHECK (category BETWEEN 1 AND 8),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'in_progress', 'finished')),
    format TEXT NOT NULL DEFAULT 'home_away' CHECK (format IN ('home_away', 'neutral', 'single_round')),
    rules JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clubs participantes en intercountry
CREATE TABLE IF NOT EXISTS intercountry_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES intercountry_tournaments(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'suspended')),
    points INTEGER DEFAULT 0,
    matches_played INTEGER DEFAULT 0,
    matches_won INTEGER DEFAULT 0,
    matches_drawn INTEGER DEFAULT 0,
    matches_lost INTEGER DEFAULT 0,
    sets_won INTEGER DEFAULT 0,
    sets_lost INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    UNIQUE(tournament_id, club_id)
);

-- Jugadores registrados por club para intercountry
CREATE TABLE IF NOT EXISTS intercountry_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES intercountry_tournaments(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category INTEGER NOT NULL,
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'injured', 'suspended', 'withdrawn')),
    UNIQUE(tournament_id, user_id)
);

-- Fixture de intercountry
CREATE TABLE IF NOT EXISTS intercountry_fixtures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES intercountry_tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    matchday INTEGER,
    home_club_id UUID NOT NULL REFERENCES clubs(id),
    away_club_id UUID NOT NULL REFERENCES clubs(id),
    home_team JSONB, -- [{user_id, name}, {user_id, name}]
    away_team JSONB,
    sets JSONB,
    home_games INTEGER DEFAULT 0,
    away_games INTEGER DEFAULT 0,
    home_sets INTEGER DEFAULT 0,
    away_sets INTEGER DEFAULT 0,
    winner_club_id UUID REFERENCES clubs(id),
    scheduled_date TIMESTAMPTZ,
    court_number INTEGER,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posiciones/Tabla de intercountry
CREATE VIEW intercountry_standings AS
SELECT 
    p.id,
    p.tournament_id,
    p.club_id,
    c.name as club_name,
    p.points,
    p.matches_played,
    p.matches_won,
    p.matches_drawn,
    p.matches_lost,
    p.sets_won,
    p.sets_lost,
    p.games_won,
    p.games_lost,
    CASE WHEN p.sets_lost > 0 THEN ROUND(p.sets_won::NUMERIC / p.sets_lost, 2) ELSE p.sets_won END as set_ratio,
    CASE WHEN p.games_lost > 0 THEN ROUND(p.games_won::NUMERIC / p.games_lost, 2) ELSE p.games_won END as game_ratio,
    RANK() OVER (PARTITION BY p.tournament_id ORDER BY p.points DESC, (p.sets_won - p.sets_lost) DESC, (p.games_won - p.games_lost) DESC) as position
FROM intercountry_participants p
JOIN clubs c ON p.club_id = c.id
WHERE p.status = 'active';

-- ============================================
-- FUNCIONES Y TRIGGERS
-- ============================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_tournaments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tournaments_updated_at ON tournaments;
CREATE TRIGGER update_tournaments_updated_at
    BEFORE UPDATE ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION update_tournaments_updated_at();

DROP TRIGGER IF EXISTS update_intercountry_tournaments_updated_at ON intercountry_tournaments;
CREATE TRIGGER update_intercountry_tournaments_updated_at
    BEFORE UPDATE ON intercountry_tournaments
    FOR EACH ROW
    EXECUTE FUNCTION update_tournaments_updated_at();

-- Función para generar bracket de eliminación simple
CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(tournament_uuid UUID)
RETURNS VOID AS $$
DECLARE
    participants RECORD;
    num_participants INTEGER;
    rounds INTEGER;
    current_round INTEGER;
    matches_in_round INTEGER;
    i INTEGER;
    j INTEGER;
BEGIN
    -- Obtener participantes confirmados ordenados por seed
    SELECT COUNT(*) INTO num_participants
    FROM tournament_registrations
    WHERE tournament_id = tournament_uuid AND status = 'confirmed';
    
    -- Calcular número de rondas
    rounds := CEIL(LOG(2, num_participants));
    
    -- Crear partidos por ronda
    FOR current_round IN 1..rounds LOOP
        matches_in_round := POWER(2, rounds - current_round);
        
        FOR i IN 1..matches_in_round LOOP
            INSERT INTO tournament_matches (
                tournament_id,
                round,
                match_number,
                bracket_position,
                status
            ) VALUES (
                tournament_uuid,
                current_round,
                i,
                'R' || current_round || '-M' || i,
                CASE WHEN matches_in_round > num_participants / 2 AND i > num_participants - matches_in_round THEN 'bye' ELSE 'pending' END
            );
        END LOOP;
    END LOOP;
    
    -- Asignar participantes al primer round
    -- (Esto es simplificado, en producción harías el sorteo/seeding)
    UPDATE tournament_matches
    SET 
        team_a = (SELECT jsonb_agg(jsonb_build_object('user_id', r.user_id)) 
                  FROM (SELECT user_id FROM tournament_registrations 
                        WHERE tournament_id = tournament_uuid AND status = 'confirmed'
                        ORDER BY seed, registration_date
                        LIMIT 1 OFFSET (match_number - 1) * 2) r),
        team_b = (SELECT jsonb_agg(jsonb_build_object('user_id', r.user_id)) 
                  FROM (SELECT user_id FROM tournament_registrations 
                        WHERE tournament_id = tournament_uuid AND status = 'confirmed'
                        ORDER BY seed, registration_date
                        LIMIT 1 OFFSET (match_number - 1) * 2 + 1) r)
    WHERE tournament_id = tournament_uuid AND round = 1 AND status != 'bye';
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar standings de intercountry
CREATE OR REPLACE FUNCTION update_intercountry_standings()
RETURNS TRIGGER AS $$
DECLARE
    home_points INTEGER;
    away_points INTEGER;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Calcular sets y games
        NEW.home_sets := (SELECT COUNT(*) FROM jsonb_array_elements(NEW.sets) s WHERE (s->>'games_a')::int > (s->>'games_b')::int);
        NEW.away_sets := (SELECT COUNT(*) FROM jsonb_array_elements(NEW.sets) s WHERE (s->>'games_b')::int > (s->>'games_a')::int);
        NEW.home_games := (SELECT COALESCE(SUM((s->>'games_a')::int), 0) FROM jsonb_array_elements(NEW.sets) s);
        NEW.away_games := (SELECT COALESCE(SUM((s->>'games_b')::int), 0) FROM jsonb_array_elements(NEW.sets) s);
        
        -- Determinar ganador
        IF NEW.home_sets > NEW.away_sets THEN
            NEW.winner_club_id := NEW.home_club_id;
            home_points := 3;
            away_points := 0;
        ELSIF NEW.away_sets > NEW.home_sets THEN
            NEW.winner_club_id := NEW.away_club_id;
            home_points := 0;
            away_points := 3;
        ELSE
            home_points := 1;
            away_points := 1;
        END IF;
        
        -- Actualizar standings del club local
        UPDATE intercountry_participants SET
            matches_played = matches_played + 1,
            matches_won = matches_won + CASE WHEN home_points = 3 THEN 1 ELSE 0 END,
            matches_drawn = matches_drawn + CASE WHEN home_points = 1 THEN 1 ELSE 0 END,
            matches_lost = matches_lost + CASE WHEN home_points = 0 THEN 1 ELSE 0 END,
            sets_won = sets_won + NEW.home_sets,
            sets_lost = sets_lost + NEW.away_sets,
            games_won = games_won + NEW.home_games,
            games_lost = games_lost + NEW.away_games,
            points = points + home_points
        WHERE tournament_id = NEW.tournament_id AND club_id = NEW.home_club_id;
        
        -- Actualizar standings del club visitante
        UPDATE intercountry_participants SET
            matches_played = matches_played + 1,
            matches_won = matches_won + CASE WHEN away_points = 3 THEN 1 ELSE 0 END,
            matches_drawn = matches_drawn + CASE WHEN away_points = 1 THEN 1 ELSE 0 END,
            matches_lost = matches_lost + CASE WHEN away_points = 0 THEN 1 ELSE 0 END,
            sets_won = sets_won + NEW.away_sets,
            sets_lost = sets_lost + NEW.home_sets,
            games_won = games_won + NEW.away_games,
            games_lost = games_lost + NEW.home_games,
            points = points + away_points
        WHERE tournament_id = NEW.tournament_id AND club_id = NEW.away_club_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_intercountry_standings_trigger ON intercountry_fixtures;
CREATE TRIGGER update_intercountry_standings_trigger
    BEFORE UPDATE ON intercountry_fixtures
    FOR EACH ROW
    EXECUTE FUNCTION update_intercountry_standings();

-- ============================================
-- DATOS DE PRUEBA
-- ============================================

-- Insertar un torneo de ejemplo
INSERT INTO tournaments (
    club_id, name, description, type, category, max_participants,
    registration_start_date, registration_end_date, start_date, status, created_by
) VALUES (
    (SELECT id FROM clubs LIMIT 1),
    'Torneo de Apertura 2024',
    'Torneo eliminación simple para categoría 4ta',
    'single_elimination',
    4,
    16,
    NOW(),
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '14 days',
    'registration_open',
    (SELECT id FROM users WHERE club_id = (SELECT id FROM clubs LIMIT 1) LIMIT 1)
);

-- Insertar un intercountry de ejemplo
INSERT INTO intercountry_tournaments (
    club_id, name, format, num_teams, num_dates, status
) VALUES (
    (SELECT id FROM clubs LIMIT 1),
    'Intercountry 2024 - 4ta Categoría',
    'liga',
    8,
    10,
    'upcoming'
);

-- Agregar club actual al intercountry
INSERT INTO intercountry_participants (tournament_id, club_id)
SELECT 
    (SELECT id FROM intercountry_tournaments WHERE name LIKE 'Intercountry 2024%' LIMIT 1),
    id 
FROM clubs 
LIMIT 1;
