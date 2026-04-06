-- Courts Management System

-- Courts Table
CREATE TABLE IF NOT EXISTS courts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    number INTEGER NOT NULL,
    surface TEXT NOT NULL CHECK (surface IN ('clay', 'hard', 'grass', 'carpet')),
    indoor BOOLEAN DEFAULT false,
    lights BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    hourly_rate DECIMAL(10,2), -- Hourly rate for bookings
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique court number per club
    UNIQUE(club_id, number)
);

-- Court Schedules (operating hours)
CREATE TABLE IF NOT EXISTS court_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    court_id UUID REFERENCES courts(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    opening_time TIME NOT NULL DEFAULT '08:00:00',
    closing_time TIME NOT NULL DEFAULT '22:00:00',
    break_start TIME, -- Optional break time (e.g., lunch)
    break_end TIME,
    max_booking_hours INTEGER DEFAULT 3, -- Max hours per booking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique schedule per court per day
    UNIQUE(club_id, court_id, day_of_week)
);

-- Court Bookings/Reservations
CREATE TABLE IF NOT EXISTS court_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    court_id UUID REFERENCES courts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours INTEGER NOT NULL, -- Duration in hours
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    total_cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default schedules for existing courts (only if courts exist)
DO $$
BEGIN
    -- Only insert schedules if there are courts
    IF EXISTS (SELECT 1 FROM courts LIMIT 1) THEN
        INSERT INTO court_schedules (club_id, court_id, day_of_week)
        SELECT 
            c.id as club_id,
            ct.id as court_id,
            d.day_of_week
        FROM clubs c
        INNER JOIN courts ct ON ct.club_id = c.id
        CROSS JOIN (
            SELECT generate_series(0, 6) as day_of_week
        ) d
        ON CONFLICT (club_id, court_id, day_of_week) DO NOTHING;
    END IF;
END $$;

-- Note: Indexes will be created in separate migration after tables are populated
