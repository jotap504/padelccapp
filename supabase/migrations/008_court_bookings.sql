-- ============================================
-- SISTEMA DE RESERVA DE CANCHAS
-- ============================================

-- Tabla de canchas
CREATE TABLE IF NOT EXISTS courts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    court_number INTEGER,
    type TEXT DEFAULT 'indoor' CHECK (type IN ('indoor', 'outdoor', 'covered')),
    surface TEXT DEFAULT 'synthetic' CHECK (surface IN ('synthetic', 'clay', 'grass', 'concrete')),
    
    -- Capacidad
    max_players INTEGER DEFAULT 4,
    
    -- Características
    has_lighting BOOLEAN DEFAULT true,
    has_restrooms BOOLEAN DEFAULT false,
    has_showers BOOLEAN DEFAULT false,
    
    -- Precios por hora (para sistema de pagos futuro)
    price_per_hour DECIMAL(10,2),
    member_price_per_hour DECIMAL(10,2),
    
    -- Estado
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de horarios de canchas (slots disponibles)
CREATE TABLE IF NOT EXISTS court_time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    
    -- Día de la semana (0=Domingo, 1=Lunes, ...)
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    
    -- Horario
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Duración del turno en minutos
    slot_duration_minutes INTEGER DEFAULT 60,
    
    -- Precio específico para este horario
    price_override DECIMAL(10,2),
    
    -- Estado del horario
    is_available BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de reservas
CREATE TABLE IF NOT EXISTS court_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    
    -- Quien reserva
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Fecha y hora
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Estado de la reserva
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
    
    -- Tipo de reserva
    booking_type TEXT DEFAULT 'casual' CHECK (booking_type IN ('casual', 'tournament', 'lesson', 'maintenance')),
    
    -- Jugadores (JSON array con user_ids)
    players JSONB DEFAULT '[]',
    
    -- Notas
    notes TEXT,
    
    -- Si está vinculada a un partido
    match_id UUID REFERENCES matches(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    
    -- Evitar reservas duplicadas
    UNIQUE(court_id, booking_date, start_time)
);

-- Tabla de bloqueos de canchas (mantenimiento, eventos)
CREATE TABLE IF NOT EXISTS court_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    
    -- Periodo
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    
    -- Tipo de bloqueo
    block_type TEXT DEFAULT 'maintenance' CHECK (block_type IN ('maintenance', 'event', 'private', 'other')),
    
    -- Descripción
    description TEXT,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_courts_club ON courts(club_id);
CREATE INDEX IF NOT EXISTS idx_courts_status ON courts(status);

CREATE INDEX IF NOT EXISTS idx_court_time_slots_court ON court_time_slots(court_id);
CREATE INDEX IF NOT EXISTS idx_court_time_slots_day ON court_time_slots(day_of_week);

CREATE INDEX IF NOT EXISTS idx_court_bookings_court ON court_bookings(court_id);
CREATE INDEX IF NOT EXISTS idx_court_bookings_date ON court_bookings(date);
CREATE INDEX IF NOT EXISTS idx_court_bookings_user ON court_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_court_bookings_status ON court_bookings(status);

CREATE INDEX IF NOT EXISTS idx_court_blocks_court ON court_blocks(court_id);
CREATE INDEX IF NOT EXISTS idx_court_blocks_dates ON court_blocks(start_date, end_date);

-- ============================================
-- VISTAS
-- ============================================

-- Vista de disponibilidad de canchas
CREATE VIEW court_availability AS
SELECT 
    c.id as court_id,
    c.name as court_name,
    c.club_id,
    cb.date as booking_date,
    cb.start_time as booked_start,
    cb.end_time as booked_end,
    cb.status as booking_status,
    cb.user_id as booked_by,
    u.name as booked_by_name,
    CASE 
        WHEN cb.id IS NULL OR cb.status IN ('cancelled', 'completed') THEN true
        ELSE false
    END as is_available
FROM courts c
LEFT JOIN court_bookings cb ON c.id = cb.court_id AND cb.date >= CURRENT_DATE
LEFT JOIN users u ON cb.user_id = u.id
WHERE c.status = 'active';

-- ============================================
-- FUNCIONES
-- ============================================

-- Función para obtener slots disponibles para una fecha
CREATE OR REPLACE FUNCTION get_available_slots(
    p_court_id UUID,
    p_date DATE
)
RETURNS TABLE (
    slot_start TIME,
    slot_end TIME,
    is_available BOOLEAN
) AS $$
DECLARE
    day_num INTEGER;
    slot RECORD;
    has_booking BOOLEAN;
BEGIN
    day_num := EXTRACT(DOW FROM p_date);
    
    FOR slot IN 
        SELECT start_time, end_time, slot_duration_minutes
        FROM court_time_slots
        WHERE court_id = p_court_id
        AND day_of_week = day_num
        AND is_available = true
        ORDER BY start_time
    LOOP
        -- Verificar si hay reserva para este slot
        SELECT EXISTS (
            SELECT 1 FROM court_bookings
            WHERE court_id = p_court_id
            AND date = p_date
            AND status IN ('pending', 'confirmed')
            AND (
                (start_time <= slot.start_time AND end_time > slot.start_time)
                OR (start_time < slot.end_time AND end_time >= slot.end_time)
            )
        ) INTO has_booking;
        
        slot_start := slot.start_time;
        slot_end := slot.end_time;
        is_available := NOT has_booking;
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función para crear reserva
CREATE OR REPLACE FUNCTION create_booking(
    p_club_id UUID,
    p_court_id UUID,
    p_booked_by UUID,
    p_booking_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_booking_type TEXT DEFAULT 'casual',
    p_players JSONB DEFAULT '[]',
    p_notes TEXT DEFAULT NULL,
    p_match_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    has_conflict BOOLEAN;
BEGIN
    -- Verificar conflicto
    SELECT EXISTS (
        SELECT 1 FROM court_bookings
        WHERE court_id = p_court_id
        AND booking_date = p_booking_date
        AND status IN ('pending', 'confirmed')
        AND (
            (start_time <= p_start_time AND end_time > p_start_time)
            OR (start_time < p_end_time AND end_time >= p_end_time)
        )
    ) INTO has_conflict;
    
    IF has_conflict THEN
        RAISE EXCEPTION 'El horario seleccionado no está disponible';
    END IF;
    
    -- Crear reserva
    INSERT INTO court_bookings (
        club_id,
        court_id,
        booked_by,
        booking_date,
        start_time,
        end_time,
        booking_type,
        players,
        notes,
        match_id
    ) VALUES (
        p_club_id,
        p_court_id,
        p_booked_by,
        p_booking_date,
        p_start_time,
        p_end_time,
        p_booking_type,
        p_players,
        p_notes,
        p_match_id
    )
    RETURNING id INTO new_id;
    
    -- Notificar a los jugadores
    INSERT INTO notifications (
        user_id,
        club_id,
        type,
        title,
        message,
        data
    )
    SELECT 
        (p->>'user_id')::uuid,
        p_club_id,
        'match_created',
        'Reserva de Cancha',
        'Se reservó la cancha ' || (SELECT name FROM courts WHERE id = p_court_id) || ' para el ' || p_booking_date || ' a las ' || p_start_time,
        jsonb_build_object('booking_id', new_id)
    FROM jsonb_array_elements(p_players) as p
    WHERE p->>'user_id' != p_booked_by::text;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Función para cancelar reserva
CREATE OR REPLACE FUNCTION cancel_booking(
    p_booking_id UUID,
    p_cancelled_by UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE court_bookings
    SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = p_cancelled_by,
        cancellation_reason = p_reason
    WHERE id = p_booking_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_court_booking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_court_booking_timestamp ON court_bookings;
CREATE TRIGGER update_court_booking_timestamp
    BEFORE UPDATE ON court_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_court_booking_timestamp();

-- ============================================
-- DATOS DE PRUEBA
-- ============================================

-- Insertar canchas de ejemplo
INSERT INTO courts (club_id, name, number, type, surface_type, has_lighting)
SELECT 
    id as club_id,
    'Cancha ' || n as name,
    n as number,
    CASE WHEN n % 2 = 0 THEN 'padel' ELSE 'tennis' END as type,
    'artificial_grass' as surface_type,
    true as has_lighting
FROM clubs
CROSS JOIN generate_series(1, 4) as n
ON CONFLICT DO NOTHING;

-- Crear horarios de ejemplo (Lunes a Domingo, 8:00 a 23:00)
INSERT INTO court_time_slots (court_id, day_of_week, start_time, end_time, slot_duration_minutes)
SELECT 
    c.id as court_id,
    d.day as day_of_week,
    h.start_time,
    h.start_time + INTERVAL '1 hour' as end_time,
    60 as slot_duration_minutes
FROM courts c
CROSS JOIN generate_series(0, 6) as d(day)
CROSS JOIN (
    SELECT generate_series(8, 22) as hour, 
           (generate_series(8, 22) || ':00:00')::time as start_time
) h
WHERE c.status = 'active'
ON CONFLICT DO NOTHING;
