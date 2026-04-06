-- ============================================
-- SISTEMA DE DISPONIBILIDAD Y MATCHING
-- ============================================

-- Tabla de disponibilidad de jugadores
CREATE TABLE IF NOT EXISTS player_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    court_preference TEXT, -- 'covered', 'uncovered', 'any'
    category_preferred INTEGER, -- categoría preferida de rivales (null = cualquiera)
    match_type TEXT DEFAULT 'singles' CHECK (match_type IN ('singles', 'doubles', 'both')),
    notes TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern JSONB, -- {frequency: 'weekly', days: [1,3,5]}
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'matched', 'cancelled', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de matches de disponibilidad
CREATE TABLE IF NOT EXISTS availability_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    availability_a_id UUID NOT NULL REFERENCES player_availability(id) ON DELETE CASCADE,
    availability_b_id UUID NOT NULL REFERENCES player_availability(id) ON DELETE CASCADE,
    user_a_id UUID NOT NULL REFERENCES users(id),
    user_b_id UUID NOT NULL REFERENCES users(id),
    proposed_date DATE NOT NULL,
    proposed_start_time TIME NOT NULL,
    proposed_end_time TIME NOT NULL,
    court_id UUID,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'expired')),
    confirmed_by UUID[], -- ids de usuarios que confirmaron
    created_at TIMESTAMPTZ DEFAULT NOW(),
    matched_at TIMESTAMPTZ,
    UNIQUE(availability_a_id, availability_b_id)
);

-- Función para encontrar coincidencias de disponibilidad
CREATE OR REPLACE FUNCTION find_availability_matches(avail_id UUID)
RETURNS TABLE (
    matching_avail_id UUID,
    user_id UUID,
    user_name TEXT,
    user_category INTEGER,
    overlap_start TIME,
    overlap_end TIME,
    date_match DATE,
    score NUMERIC
) AS $$
DECLARE
    avail_record RECORD;
BEGIN
    -- Obtener la disponibilidad actual
    SELECT * INTO avail_record 
    FROM player_availability 
    WHERE id = avail_id AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        pa.id as matching_avail_id,
        pa.user_id,
        u.name as user_name,
        u.category as user_category,
        GREATEST(avail_record.start_time, pa.start_time) as overlap_start,
        LEAST(avail_record.end_time, pa.end_time) as overlap_end,
        pa.date as date_match,
        -- Score basado en: tiempo de overlap, diferencia de categoría, preferencias
        (
            EXTRACT(EPOCH FROM (LEAST(avail_record.end_time, pa.end_time) - GREATEST(avail_record.start_time, pa.start_time))) / 3600.0
            * (1.0 - ABS(COALESCE(avail_record.category_preferred, u.category) - u.category) * 0.1)
            * CASE 
                WHEN avail_record.match_type = 'both' OR pa.match_type = 'both' OR avail_record.match_type = pa.match_type 
                THEN 1.0 
                ELSE 0.5 
              END
        )::NUMERIC as score
    FROM player_availability pa
    JOIN users u ON pa.user_id = u.id
    WHERE pa.club_id = avail_record.club_id
        AND pa.user_id != avail_record.user_id
        AND pa.date = avail_record.date
        AND pa.status = 'active'
        AND pa.start_time < avail_record.end_time
        AND pa.end_time > avail_record.start_time
        -- Filtro de categoría si está especificado
        AND (avail_record.category_preferred IS NULL OR 
             ABS(u.category - COALESCE(avail_record.category_preferred, u.category)) <= 2)
    ORDER BY score DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para crear un match automáticamente cuando hay coincidencia
CREATE OR REPLACE FUNCTION auto_create_availability_match()
RETURNS TRIGGER AS $$
DECLARE
    best_match RECORD;
    existing_match UUID;
BEGIN
    -- Buscar la mejor coincidencia
    SELECT * INTO best_match
    FROM find_availability_matches(NEW.id)
    LIMIT 1;
    
    IF FOUND THEN
        -- Verificar que no exista ya un match
        SELECT id INTO existing_match
        FROM availability_matches
        WHERE (availability_a_id = NEW.id AND availability_b_id = best_match.matching_avail_id)
           OR (availability_a_id = best_match.matching_avail_id AND availability_b_id = NEW.id)
        LIMIT 1;
        
        IF existing_match IS NULL THEN
            -- Crear el match
            INSERT INTO availability_matches (
                availability_a_id,
                availability_b_id,
                user_a_id,
                user_b_id,
                proposed_date,
                proposed_start_time,
                proposed_end_time,
                status
            ) VALUES (
                NEW.id,
                best_match.matching_avail_id,
                NEW.user_id,
                best_match.user_id,
                best_match.date_match,
                best_match.overlap_start,
                best_match.overlap_end,
                'pending'
            );
            
            -- Actualizar estados
            UPDATE player_availability SET status = 'matched' WHERE id = NEW.id;
            UPDATE player_availability SET status = 'matched' WHERE id = best_match.matching_avail_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-matching (opcional, puede deshabilitarse para matching manual)
-- CREATE TRIGGER auto_match_availability
--     AFTER INSERT ON player_availability
--     FOR EACH ROW
--     EXECUTE FUNCTION auto_create_availability_match();

-- Vista para ver disponibilidad con info de usuario
DROP VIEW IF EXISTS player_availability_view;
CREATE VIEW player_availability_view AS
SELECT 
    pa.*,
    u.name as user_name,
    u.category as user_category,
    u.rating as user_rating,
    CASE 
        WHEN pa.match_type = 'singles' THEN 'Individual'
        WHEN pa.match_type = 'doubles' THEN 'Dobles'
        ELSE 'Individual o Dobles'
    END as match_type_label,
    CASE 
        WHEN pa.court_preference = 'covered' THEN 'Cubierta'
        WHEN pa.court_preference = 'uncovered' THEN 'Descubierta'
        ELSE 'Indistinto'
    END as court_preference_label
FROM player_availability pa
JOIN users u ON pa.user_id = u.id
WHERE pa.status = 'active' AND pa.date >= CURRENT_DATE;

-- ============================================
-- CANCHAS Y RESERVAS (Opcional para futuro)
-- ============================================

-- Tabla de canchas del club
CREATE TABLE IF NOT EXISTS courts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    number INTEGER,
    type TEXT DEFAULT 'padel' CHECK (type IN ('padel', 'tennis', 'fronton')),
    is_covered BOOLEAN DEFAULT false,
    has_lighting BOOLEAN DEFAULT false,
    surface_type TEXT DEFAULT 'artificial_grass' CHECK (surface_type IN ('artificial_grass', 'concrete', 'porous_concrete', 'clay')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de reservas de canchas
CREATE TABLE IF NOT EXISTS court_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    match_id UUID REFERENCES matches(id),
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DATOS DE PRUEBA
-- ============================================

-- Insertar canchas de ejemplo si no existen
INSERT INTO courts (club_id, name, number, is_covered, has_lighting)
SELECT 
    id,
    'Cancha ' || generate_series,
    generate_series,
    generate_series % 2 = 0,
    true
FROM clubs, generate_series(1, 4)
WHERE NOT EXISTS (SELECT 1 FROM courts WHERE courts.club_id = clubs.id)
LIMIT 4;

-- Insertar disponibilidades de ejemplo
INSERT INTO player_availability (user_id, club_id, date, start_time, end_time, match_type)
SELECT 
    u.id,
    u.club_id,
    CURRENT_DATE + (random() * 7)::int,
    '18:00'::time + (random() * 4 || ' hours')::interval,
    '22:00'::time,
    CASE WHEN random() > 0.5 THEN 'singles' ELSE 'doubles' END
FROM users u
WHERE u.status = 'active'
LIMIT 10;
