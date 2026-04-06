-- Redesigned Intercountry Tournament Structure

-- Tournament Organizers (separate from clubs)
CREATE TABLE IF NOT EXISTS intercountry_organizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    contact_phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Tournament Structure
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES intercountry_organizers(id),
ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'league' CHECK (tournament_type IN ('league', 'cup', 'league_cup')),
ADD COLUMN IF NOT EXISTS season_type TEXT DEFAULT 'semester' CHECK (season_type IN ('semester', 'year')),
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS min_teams INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS max_teams INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS playoff_format TEXT DEFAULT 'full' CHECK (playoff_format IN ('full', 'semis_final', 'none')),
ADD COLUMN IF NOT EXISTS default_match_day TEXT DEFAULT 'sunday',
ADD COLUMN IF NOT EXISTS matches_per_round INTEGER DEFAULT 2;

-- Team Performance Tracking
CREATE TABLE IF NOT EXISTS intercountry_team_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES intercountry_tournaments(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id),
    round INTEGER NOT NULL,
    match_id UUID REFERENCES intercountry_fixtures(id),
    player_combination JSONB, -- [{player_id, role, performance_score}]
    result_score INTEGER,
    opponent_strength INTEGER,
    weather_conditions TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Suggestions Log
CREATE TABLE IF NOT EXISTS intercountry_ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES intercountry_tournaments(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id),
    round INTEGER NOT NULL,
    opponent_id UUID REFERENCES clubs(id),
    suggested_team JSONB, -- [{player_id, confidence_score, reasoning}]
    alternative_teams JSONB, -- Array of alternative suggestions
    factors_used JSONB, -- {ranking_weight, availability_weight, chemistry_weight, etc}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player Chemistry Data
CREATE TABLE IF NOT EXISTS player_chemistry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID NOT NULL REFERENCES users(id),
    player2_id UUID NOT NULL REFERENCES users(id),
    club_id UUID NOT NULL REFERENCES clubs(id),
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    average_score DECIMAL(5,2),
    chemistry_score DECIMAL(3,2) DEFAULT 5.0, -- 1-10 scale
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player1_id, player2_id, club_id)
);

-- Playoff Brackets
CREATE TABLE IF NOT EXISTS intercountry_playoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES intercountry_tournaments(id) ON DELETE CASCADE,
    round TEXT NOT NULL CHECK (round IN ('round_of_16', 'quarter_finals', 'semi_finals', 'final')),
    bracket_position INTEGER NOT NULL, -- 1, 2, 3, 4 for bracket positioning
    home_club_id UUID REFERENCES clubs(id),
    away_club_id UUID REFERENCES clubs(id),
    winner_club_id UUID REFERENCES clubs(id),
    scheduled_date TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament Configuration for AI
CREATE TABLE IF NOT EXISTS intercountry_ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES intercountry_tournaments(id) ON DELETE CASCADE,
    ranking_weight DECIMAL(3,2) DEFAULT 0.4,
    availability_weight DECIMAL(3,2) DEFAULT 0.3,
    chemistry_weight DECIMAL(3,2) DEFAULT 0.2,
    recent_form_weight DECIMAL(3,2) DEFAULT 0.1,
    min_chemistry_score DECIMAL(3,2) DEFAULT 6.0,
    max_players_per_match INTEGER DEFAULT 4,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id)
);

-- Insert default organizer
INSERT INTO intercountry_organizers (name, email) 
VALUES ('Liga Intercountry', 'admin@ligaintercountry.com')
ON CONFLICT DO NOTHING;
