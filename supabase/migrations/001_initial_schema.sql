-- ============================================================================
-- SISTEMA DE GESTIÓN DE PÁDEL - SCHEMA SQL COMPLETO PARA SUPABASE
-- ============================================================================
-- Este script crea todas las tablas, índices, RLS policies, triggers y funciones
-- necesarias para el sistema multi-tenant de pádel.
-- ============================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLAS PRINCIPALES
-- ============================================================================

-- 🏛️ CLUBS - Root table para multi-tenant
CREATE TABLE IF NOT EXISTS public.clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- para URLs: /club/mi-club
    logo_url TEXT,
    whatsapp_api_key TEXT, -- encrypted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 👤 USERS - Jugadores
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    
    -- Datos básicos
    name TEXT NOT NULL,
    email TEXT,
    member_number TEXT, -- número de socio del CSV
    gender CHAR(1) CHECK (gender IN ('M', 'F')),
    
    -- Características técnicas
    handedness TEXT CHECK (handedness IN ('right', 'left', 'unknown')) DEFAULT 'unknown',
    preferred_side TEXT CHECK (preferred_side IN ('drive', 'backhand', 'both', 'unknown')) DEFAULT 'unknown',
    
    -- Ranking
    category INTEGER CHECK (category BETWEEN 1 AND 8),
    rating DECIMAL(10,2),
    total_matches INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2),
    ranking_confidence INTEGER DEFAULT 0, -- partidos jugados
    initial_category INTEGER CHECK (initial_category BETWEEN 1 AND 8),
    
    -- Contacto/Notificaciones
    whatsapp_phone TEXT,
    push_subscription JSONB,
    email_notifications BOOLEAN DEFAULT TRUE,
    
    -- Estado
    status TEXT CHECK (status IN ('active', 'pending', 'inactive')) DEFAULT 'active',
    imported_from_csv BOOLEAN DEFAULT FALSE,
    auth_provider TEXT CHECK (auth_provider IN ('email', 'oauth', 'imported')) DEFAULT 'email',
    
    -- Auth (usando bcrypt)
    password_hash TEXT, -- hashed password
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints únicos
    CONSTRAINT unique_member_number_per_club UNIQUE (club_id, member_number),
    CONSTRAINT unique_email_per_club UNIQUE (club_id, email)
);

-- 🔐 PASSWORD_RESETS - Tokens para reset de contraseña
CREATE TABLE IF NOT EXISTS public.password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL, -- hash del token (no guardar token plano)
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 🎾 MATCHES - Partidos
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id),
    date TIMESTAMPTZ NOT NULL,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'disputed', 'cancelled')) DEFAULT 'pending',
    team_a JSONB NOT NULL, -- [{user_id, side, position}, ...]
    team_b JSONB NOT NULL, -- [{user_id, side, position}, ...]
    sets JSONB, -- [{games_a: 6, games_b: 4}, ...]
    games_diff INTEGER,
    validated_by UUID[], -- max 2 (uno por equipo)
    validation_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 📊 MATCH_LINEUPS - Posiciones específicas por partido
CREATE TABLE IF NOT EXISTS public.match_lineups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    team TEXT CHECK (team IN ('A', 'B')) NOT NULL,
    side TEXT CHECK (side IN ('drive', 'backhand')) NOT NULL,
    position TEXT CHECK (position IN ('left', 'right')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 📊 RANKING_HISTORY - Historial de cambios de ranking
CREATE TABLE IF NOT EXISTS public.ranking_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    rating_before DECIMAL(10,2) NOT NULL,
    rating_after DECIMAL(10,2) NOT NULL,
    delta DECIMAL(10,2) NOT NULL,
    position_change INTEGER, -- +/- posición en ranking
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 📅 AVAILABILITY - Disponibilidad de jugadores
CREATE TABLE IF NOT EXISTS public.availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    available BOOLEAN DEFAULT TRUE,
    reason TEXT, -- opcional: "vacaciones", "lesión", etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- 📥 PLAYER_IMPORTS - Log de importaciones CSV
CREATE TABLE IF NOT EXISTS public.player_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB, -- [{row: 5, error: "duplicado"}]
    imported_by UUID REFERENCES public.users(id),
    status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. TABLAS INTERCOUNTRY
-- ============================================================================

-- 🏆 INTERCOUNTRY_TOURNAMENTS
CREATE TABLE IF NOT EXISTS public.intercountry_tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    format TEXT CHECK (format IN ('liga', 'eliminatoria', 'mixto')) DEFAULT 'liga',
    num_teams INTEGER NOT NULL DEFAULT 8,
    num_dates INTEGER NOT NULL DEFAULT 10,
    status TEXT CHECK (status IN ('upcoming', 'group_stage', 'playoffs', 'finished')) DEFAULT 'upcoming',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 👥 INTERCOUNTRY_TEAMS
CREATE TABLE IF NOT EXISTS public.intercountry_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.intercountry_tournaments(id) ON DELETE CASCADE,
    club_name TEXT NOT NULL, -- "Club Atlético River"
    home_court_address TEXT,
    players UUID[], -- array de user_ids
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 📅 INTERCOUNTRY_FIXTURES
CREATE TABLE IF NOT EXISTS public.intercountry_fixtures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.intercountry_tournaments(id) ON DELETE CASCADE,
    date TIMESTAMPTZ,
    round INTEGER NOT NULL, -- fecha 1, 2, 3...
    home_team_id UUID REFERENCES public.intercountry_teams(id),
    away_team_id UUID REFERENCES public.intercountry_teams(id),
    home_court_id UUID,
    status TEXT CHECK (status IN ('scheduled', 'confirmed', 'completed')) DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 🎾 INTERCOUNTRY_MATCHES
CREATE TABLE IF NOT EXISTS public.intercountry_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fixture_id UUID NOT NULL REFERENCES public.intercountry_fixtures(id) ON DELETE CASCADE,
    match_type TEXT CHECK (match_type IN ('1st_doubles', '2nd_doubles', '3rd_doubles', 'singles')),
    home_pair UUID[], -- [player1, player2]
    away_pair UUID[], -- [player1, player2]
    sets JSONB,
    home_games INTEGER DEFAULT 0,
    away_games INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'confirmed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. NOTIFICACIONES
-- ============================================================================

-- 🔔 NOTIFICATIONS - Cola de notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('whatsapp', 'push', 'email')) NOT NULL,
    template TEXT CHECK (template IN ('match_created', 'validation_request', 'confirmed', 'password_reset', 'welcome')) NOT NULL,
    payload JSONB, -- datos para el template
    status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_club_id ON public.users(club_id);
CREATE INDEX IF NOT EXISTS idx_users_member_number ON public.users(club_id, member_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(club_id, email);
CREATE INDEX IF NOT EXISTS idx_users_rating ON public.users(club_id, rating DESC);

CREATE INDEX IF NOT EXISTS idx_matches_club_id ON public.matches(club_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created_by ON public.matches(created_by);

CREATE INDEX IF NOT EXISTS idx_ranking_history_user_id ON public.ranking_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ranking_history_match_id ON public.ranking_history(match_id);
CREATE INDEX IF NOT EXISTS idx_ranking_history_created_at ON public.ranking_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_availability_user_id ON public.availability(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON public.availability(date);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON public.notifications(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON public.password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON public.password_resets(token_hash);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) - MULTI-TENANT ISOLATION
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercountry_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercountry_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercountry_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercountry_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Function para obtener club_id actual del contexto
CREATE OR REPLACE FUNCTION public.get_current_club_id()
RETURNS UUID AS $$
DECLARE
    club_id UUID;
BEGIN
    -- Intentar obtener del setting de aplicación (seteado por middleware)
    BEGIN
        club_id := current_setting('app.current_club_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        club_id := NULL;
    END;
    
    -- Fallback: si el usuario es super_admin, permitir acceso
    IF club_id IS NULL THEN
        -- Verificar si es super_admin basado en claims de JWT
        BEGIN
            IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'super_admin' THEN
                RETURN NULL; -- NULL = acceso a todos los clubs
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
    
    RETURN club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies para clubs (solo super_admin puede crear/modificar)
DROP POLICY IF EXISTS clubs_select ON public.clubs;
CREATE POLICY clubs_select ON public.clubs
    FOR SELECT USING (true); -- Cualquiera puede ver clubs públicos

-- Policies para users
DROP POLICY IF EXISTS users_select_own_club ON public.users;
CREATE POLICY users_select_own_club ON public.users
    FOR SELECT USING (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

DROP POLICY IF EXISTS users_insert_own_club ON public.users;
CREATE POLICY users_insert_own_club ON public.users
    FOR INSERT WITH CHECK (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

DROP POLICY IF EXISTS users_update_own_club ON public.users;
CREATE POLICY users_update_own_club ON public.users
    FOR UPDATE USING (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

DROP POLICY IF EXISTS users_delete_own_club ON public.users;
CREATE POLICY users_delete_own_club ON public.users
    FOR DELETE USING (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

-- Policies para matches
DROP POLICY IF EXISTS matches_select_own_club ON public.matches;
CREATE POLICY matches_select_own_club ON public.matches
    FOR SELECT USING (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

DROP POLICY IF EXISTS matches_insert_own_club ON public.matches;
CREATE POLICY matches_insert_own_club ON public.matches
    FOR INSERT WITH CHECK (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

DROP POLICY IF EXISTS matches_update_own_club ON public.matches;
CREATE POLICY matches_update_own_club ON public.matches
    FOR UPDATE USING (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

DROP POLICY IF EXISTS matches_delete_own_club ON public.matches;
CREATE POLICY matches_delete_own_club ON public.matches
    FOR DELETE USING (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

-- Policies para ranking_history
DROP POLICY IF EXISTS ranking_history_select_own_club ON public.ranking_history;
CREATE POLICY ranking_history_select_own_club ON public.ranking_history
    FOR SELECT USING (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

-- Policies para availability
DROP POLICY IF EXISTS availability_select_own ON public.availability;
CREATE POLICY availability_select_own ON public.availability
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = availability.user_id 
            AND users.club_id = public.get_current_club_id()
        ) OR public.get_current_club_id() IS NULL
    );

DROP POLICY IF EXISTS availability_insert_own ON public.availability;
CREATE POLICY availability_insert_own ON public.availability
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = availability.user_id 
            AND users.club_id = public.get_current_club_id()
        ) OR public.get_current_club_id() IS NULL
    );

-- Policies para player_imports
DROP POLICY IF EXISTS player_imports_select_own_club ON public.player_imports;
CREATE POLICY player_imports_select_own_club ON public.player_imports
    FOR SELECT USING (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

-- Policies para intercountry tables
DROP POLICY IF EXISTS intercountry_tournaments_select ON public.intercountry_tournaments;
CREATE POLICY intercountry_tournaments_select ON public.intercountry_tournaments
    FOR SELECT USING (
        club_id = public.get_current_club_id() 
        OR public.get_current_club_id() IS NULL
    );

DROP POLICY IF EXISTS intercountry_teams_select ON public.intercountry_teams;
CREATE POLICY intercountry_teams_select ON public.intercountry_teams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.intercountry_tournaments t
            WHERE t.id = intercountry_teams.tournament_id
            AND t.club_id = public.get_current_club_id()
        ) OR public.get_current_club_id() IS NULL
    );

-- Policies para notifications
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
    FOR SELECT USING (
        user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = notifications.user_id 
            AND users.club_id = public.get_current_club_id()
        )
    );

-- ============================================================================
-- 6. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_clubs_updated_at ON public.clubs;
CREATE TRIGGER update_clubs_updated_at
    BEFORE UPDATE ON public.clubs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_matches_updated_at ON public.matches;
CREATE TRIGGER update_matches_updated_at
    BEFORE UPDATE ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_availability_updated_at ON public.availability;
CREATE TRIGGER update_availability_updated_at
    BEFORE UPDATE ON public.availability
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_intercountry_tournaments_updated_at ON public.intercountry_tournaments;
CREATE TRIGGER update_intercountry_tournaments_updated_at
    BEFORE UPDATE ON public.intercountry_tournaments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function para calcular categoría desde rating
CREATE OR REPLACE FUNCTION public.get_category_from_rating(rating DECIMAL)
RETURNS INTEGER AS $$
BEGIN
    IF rating >= 1300 THEN RETURN 1;
    ELSIF rating >= 1150 THEN RETURN 2;
    ELSIF rating >= 1000 THEN RETURN 3;
    ELSIF rating >= 875 THEN RETURN 4;
    ELSIF rating >= 775 THEN RETURN 5;
    ELSIF rating >= 675 THEN RETURN 6;
    ELSIF rating >= 575 THEN RETURN 7;
    ELSE RETURN 8;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function para asignar rating inicial según categoría
CREATE OR REPLACE FUNCTION public.get_rating_for_category(category INTEGER)
RETURNS DECIMAL AS $$
BEGIN
    CASE category
        WHEN 1 THEN RETURN 1400;
        WHEN 2 THEN RETURN 1250;
        WHEN 3 THEN RETURN 1100;
        WHEN 4 THEN RETURN 950;
        WHEN 5 THEN RETURN 850;
        WHEN 6 THEN RETURN 750;
        WHEN 7 THEN RETURN 650;
        WHEN 8 THEN RETURN 550;
        ELSE RETURN 750; -- default: 6ta
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function para calcular win_rate
CREATE OR REPLACE FUNCTION public.calculate_win_rate(user_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_matches INTEGER;
    wins INTEGER;
BEGIN
    -- Contar partidos donde el usuario participó
    SELECT COUNT(*) INTO total_matches
    FROM public.matches
    WHERE status = 'confirmed'
    AND (team_a @> jsonb_build_array(jsonb_build_object('user_id', user_uuid::text))
         OR team_b @> jsonb_build_array(jsonb_build_object('user_id', user_uuid::text)));
    
    -- Contar victorias
    SELECT COUNT(*) INTO wins
    FROM public.matches m
    WHERE m.status = 'confirmed'
    AND (
        -- Victoria en team_a
        (m.team_a @> jsonb_build_array(jsonb_build_object('user_id', user_uuid::text))
         AND (m.sets->0->>'games_a')::int > (m.sets->0->>'games_b')::int)
        OR
        -- Victoria en team_b
        (m.team_b @> jsonb_build_array(jsonb_build_object('user_id', user_uuid::text))
         AND (m.sets->0->>'games_b')::int > (m.sets->0->>'games_a')::int)
    );
    
    IF total_matches = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((wins::DECIMAL / total_matches::DECIMAL) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar estadísticas del usuario después de un partido confirmado
CREATE OR REPLACE FUNCTION public.update_user_stats_after_match()
RETURNS TRIGGER AS $$
DECLARE
    player_record RECORD;
    player_id UUID;
BEGIN
    -- Solo procesar si el partido fue confirmado
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        -- Actualizar total_matches y win_rate para todos los jugadores del partido
        
        -- Jugadores de team_a
        FOR player_record IN 
            SELECT (elem->>'user_id')::UUID as uid 
            FROM jsonb_array_elements(NEW.team_a) AS elem
        LOOP
            UPDATE public.users 
            SET total_matches = total_matches + 1,
                win_rate = public.calculate_win_rate(player_record.uid),
                ranking_confidence = ranking_confidence + 1
            WHERE id = player_record.uid;
        END LOOP;
        
        -- Jugadores de team_b
        FOR player_record IN 
            SELECT (elem->>'user_id')::UUID as uid 
            FROM jsonb_array_elements(NEW.team_b) AS elem
        LOOP
            UPDATE public.users 
            SET total_matches = total_matches + 1,
                win_rate = public.calculate_win_rate(player_record.uid),
                ranking_confidence = ranking_confidence + 1
            WHERE id = player_record.uid;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_stats_on_match_confirmation ON public.matches;
CREATE TRIGGER update_user_stats_on_match_confirmation
    AFTER UPDATE ON public.matches
    FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_after_match();

-- ============================================================================
-- 7. DATOS INICIALES (Opcional - para desarrollo)
-- ============================================================================

-- Insertar club de ejemplo (descomentar para desarrollo)
-- INSERT INTO public.clubs (name, slug) 
-- VALUES ('Club de Pádel Central', 'padel-central')
-- ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 8. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE public.clubs IS 'Clubes de pádel (multi-tenant root)';
COMMENT ON TABLE public.users IS 'Jugadores registrados en el sistema';
COMMENT ON TABLE public.matches IS 'Partidos jugados entre jugadores';
COMMENT ON TABLE public.ranking_history IS 'Historial de cambios de ranking ELO';
COMMENT ON TABLE public.availability IS 'Disponibilidad de jugadores por fecha';
COMMENT ON TABLE public.player_imports IS 'Log de importaciones masivas de jugadores';
COMMENT ON TABLE public.intercountry_tournaments IS 'Torneos intercountry';
COMMENT ON TABLE public.notifications IS 'Cola de notificaciones pendientes';

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
