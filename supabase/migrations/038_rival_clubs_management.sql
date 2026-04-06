-- Rival Clubs Management System

-- Table for predefined rival clubs
CREATE TABLE IF NOT EXISTS rival_clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    city TEXT,
    province TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    website TEXT,
    social_media JSONB, -- {instagram, facebook, twitter}
    average_rating DECIMAL(3,2), -- Historical performance rating
    play_style TEXT, -- aggressive, defensive, balanced
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament Rivals (link tournaments with specific rival clubs)
CREATE TABLE IF NOT EXISTS tournament_rivals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES intercountry_tournaments(id) ON DELETE CASCADE,
    rival_club_id UUID NOT NULL REFERENCES rival_clubs(id) ON DELETE CASCADE,
    added_by_club_id UUID REFERENCES clubs(id), -- Which club added this rival
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, rival_club_id)
);

-- Rival Performance History
CREATE TABLE IF NOT EXISTS rival_performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rival_club_id UUID NOT NULL REFERENCES rival_clubs(id) ON DELETE CASCADE,
    opponent_club_id UUID REFERENCES clubs(id),
    tournament_id UUID REFERENCES intercountry_tournaments(id),
    match_date DATE,
    result TEXT CHECK (result IN ('win', 'loss', 'draw')),
    score JSONB, -- {home_sets, away_sets, games_details}
    opponent_strength_rating DECIMAL(3,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some common rival clubs (examples)
INSERT INTO rival_clubs (name, city, province, average_rating, play_style) VALUES
('Club Padel Buenos Aires', 'Buenos Aires', 'Buenos Aires', 7.5, 'aggressive'),
('La Rural Padel Club', 'Rosario', 'Santa Fe', 8.2, 'balanced'),
('Córdoba Padel Center', 'Córdoba', 'Córdoba', 7.8, 'defensive'),
('Mar del Plata Padel', 'Mar del Plata', 'Buenos Aires', 7.3, 'aggressive'),
('Mendoza Tennis & Padel', 'Mendoza', 'Mendoza', 7.6, 'balanced'),
('Salta Padel Club', 'Salta', 'Salta', 7.1, 'defensive')
ON CONFLICT (name) DO NOTHING;

-- Function to import rival clubs to tournament
CREATE OR REPLACE FUNCTION import_rival_clubs_to_tournament(
    tournament_id_param UUID,
    club_id_param UUID,
    rival_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
    imported_count INTEGER := 0;
    rival_id UUID;
BEGIN
    FOREACH rival_id IN ARRAY rival_ids LOOP
        -- Check if rival is already in tournament
        IF NOT EXISTS (
            SELECT 1 FROM tournament_rivals 
            WHERE tournament_id = tournament_id_param 
            AND rival_club_id = rival_id
        ) THEN
            -- Add rival to tournament
            INSERT INTO tournament_rivals (
                tournament_id, 
                rival_club_id, 
                added_by_club_id
            ) VALUES (
                tournament_id_param, 
                rival_id, 
                club_id_param
            );
            
            imported_count := imported_count + 1;
        END IF;
    END LOOP;
    
    RETURN imported_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get available rivals for tournament (not yet added)
CREATE OR REPLACE FUNCTION get_available_rivals(
    tournament_id_param UUID
) RETURNS TABLE (
    id UUID,
    name TEXT,
    city TEXT,
    province TEXT,
    average_rating DECIMAL(3,2),
    play_style TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rc.id,
        rc.name,
        rc.city,
        rc.province,
        rc.average_rating,
        rc.play_style
    FROM rival_clubs rc
    WHERE rc.status = 'active'
    AND NOT EXISTS (
        SELECT 1 FROM tournament_rivals tr 
        WHERE tr.tournament_id = tournament_id_param 
        AND tr.rival_club_id = rc.id
        AND tr.status = 'active'
    )
    ORDER BY rc.name;
END;
$$ LANGUAGE plpgsql;

-- Function to add manual rival club
CREATE OR REPLACE FUNCTION add_manual_rival_club(
    tournament_id_param UUID,
    club_id_param UUID,
    rival_name TEXT,
    rival_city TEXT DEFAULT NULL,
    rival_province TEXT DEFAULT NULL,
    rival_email TEXT DEFAULT NULL,
    rival_phone TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    new_rival_id UUID;
BEGIN
    -- Create new rival club
    INSERT INTO rival_clubs (
        name, 
        city, 
        province, 
        contact_email, 
        contact_phone,
        average_rating,
        play_style
    ) VALUES (
        rival_name,
        rival_city,
        rival_province,
        rival_email,
        rival_phone,
        7.0, -- Default rating
        'balanced' -- Default style
    ) 
    RETURNING id INTO new_rival_id;
    
    -- Add to tournament
    INSERT INTO tournament_rivals (
        tournament_id, 
        rival_club_id, 
        added_by_club_id
    ) VALUES (
        tournament_id_param, 
        new_rival_id, 
        club_id_param
    );
    
    RETURN new_rival_id;
END;
$$ LANGUAGE plpgsql;
