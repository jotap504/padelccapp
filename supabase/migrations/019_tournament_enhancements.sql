-- ============================================
-- MIGRATION: Tournament System Enhancements
-- - Gender field (male/female/mixed)
-- - Tournament format (americano/largo)
-- - Duration, location, time fields
-- - Eligible categories array
-- - Intercountry list manager
-- ============================================

-- ============================================
-- 1. ALTER TOURNAMENTS TABLE
-- ============================================

-- Add gender column
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS gender TEXT 
CHECK (gender IN ('male', 'female', 'mixed')) 
DEFAULT 'mixed';

-- Add tournament format (for Americano style tournaments)
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS format_type TEXT 
CHECK (format_type IN ('single_elimination', 'double_elimination', 'round_robin', 'swiss', 'americano', 'liga')) 
DEFAULT 'single_elimination';

-- Add duration (in hours)
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS duration_hours INTEGER 
CHECK (duration_hours > 0);

-- Add location
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add start time
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS start_time TIME;

-- Add eligible categories (array for multiple categories)
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS eligible_categories INTEGER[];

-- Add notify_on_create flag
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS notify_members BOOLEAN DEFAULT true;

-- ============================================
-- 2. ALTER INTERCOUNTRY TOURNAMENTS TABLE
-- ============================================

-- Add gender column
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS gender TEXT 
CHECK (gender IN ('male', 'female', 'mixed')) 
DEFAULT 'mixed';

-- Add list manager (player who can manage good-faith list)
ALTER TABLE intercountry_participants 
ADD COLUMN IF NOT EXISTS list_manager_id UUID REFERENCES users(id);

-- Add registration deadline
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;

-- ============================================
-- 3. RLS POLICIES - Admin-only creation
-- ============================================

-- Function to check if user is club admin
CREATE OR REPLACE FUNCTION is_club_admin(check_club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND club_id = check_club_id 
        AND role IN ('admin', 'superadmin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: Only admins can create tournaments
DROP POLICY IF EXISTS tournaments_insert_admin ON tournaments;
CREATE POLICY tournaments_insert_admin ON tournaments
    FOR INSERT WITH CHECK (is_club_admin(club_id));

-- Policy: Only admins can update/delete tournaments
DROP POLICY IF EXISTS tournaments_update_admin ON tournaments;
CREATE POLICY tournaments_update_admin ON tournaments
    FOR UPDATE USING (is_club_admin(club_id));

DROP POLICY IF EXISTS tournaments_delete_admin ON tournaments;
CREATE POLICY tournaments_delete_admin ON tournaments
    FOR DELETE USING (is_club_admin(club_id));

-- Policy: Only superadmins can create intercountry tournaments
DROP POLICY IF EXISTS intercountry_tournaments_insert_superadmin ON intercountry_tournaments;
CREATE POLICY intercountry_tournaments_insert_superadmin ON intercountry_tournaments
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
    );

-- Policy: Only superadmins or list managers can update intercountry registrations
DROP POLICY IF EXISTS intercountry_registrations_insert_manager ON intercountry_registrations;
CREATE POLICY intercountry_registrations_insert_manager ON intercountry_registrations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
        OR EXISTS (
            SELECT 1 FROM intercountry_participants 
            WHERE tournament_id = intercountry_registrations.tournament_id 
            AND club_id = (SELECT club_id FROM users WHERE id = auth.uid())
            AND list_manager_id = auth.uid()
        )
    );

-- ============================================
-- 4. NOTIFICATION TRIGGER FOR TOURNAMENT CREATION
-- ============================================

-- Function to notify eligible players when tournament is created
CREATE OR REPLACE FUNCTION notify_tournament_created()
RETURNS TRIGGER AS $$
DECLARE
    eligible_player RECORD;
    creator_name TEXT;
BEGIN
    -- Only notify if flag is set and status is registration_open
    IF NEW.notify_members AND NEW.status = 'registration_open' THEN
        -- Get creator name
        SELECT name INTO creator_name FROM users WHERE id = NEW.created_by;
        
        -- Notify all active club members
        FOR eligible_player IN 
            SELECT id FROM users 
            WHERE club_id = NEW.club_id 
            AND status = 'active'
            AND id != NEW.created_by
            -- Filter by eligible categories if specified
            AND (
                NEW.eligible_categories IS NULL 
                OR array_length(NEW.eligible_categories, 1) IS NULL
                OR category = ANY(NEW.eligible_categories)
            )
            -- Filter by gender if specified
            AND (
                NEW.gender = 'mixed' 
                OR (NEW.gender = 'male' AND gender IN ('male', 'other'))
                OR (NEW.gender = 'female' AND gender IN ('female', 'other'))
            )
        LOOP
            INSERT INTO notifications (
                user_id,
                club_id,
                type,
                template,
                title,
                message,
                data,
                action_url,
                action_text
            ) VALUES (
                eligible_player.id,
                NEW.club_id,
                'tournament_created',
                'tournament',
                'Nuevo Torneo: ' || NEW.name,
                creator_name || ' creó el torneo "' || NEW.name || '"',
                jsonb_build_object(
                    'tournament_id', NEW.id,
                    'tournament_name', NEW.name,
                    'category', NEW.category,
                    'gender', NEW.gender,
                    'start_date', NEW.start_date
                ),
                '/tournaments/' || NEW.id,
                'Ver Torneo'
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS notify_tournament_created_trigger ON tournaments;
CREATE TRIGGER notify_tournament_created_trigger
    AFTER INSERT ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION notify_tournament_created();

-- ============================================
-- 5. VIEW FOR INTERCOUNTRY GOOD-FAITH LIST
-- ============================================

-- Enhanced view for player selection with all relevant data
CREATE OR REPLACE VIEW intercountry_available_players AS
SELECT 
    u.id,
    u.name,
    u.category,
    u.rating,
    u.gender,
    u.member_number,
    u.total_matches,
    u.win_rate,
    u.club_id,
    c.name as club_name,
    CASE 
        WHEN u.gender = 'male' THEN 'Masculino'
        WHEN u.gender = 'female' THEN 'Femenino'
        ELSE 'Otro'
    END as gender_display,
    u.status
FROM users u
JOIN clubs c ON u.club_id = c.id
WHERE u.status = 'active'
ORDER BY u.rating DESC, u.category ASC;

-- ============================================
-- 6. FUNCTION TO GENERATE AMERICANO BRACKET
-- ============================================

CREATE OR REPLACE FUNCTION generate_americano_bracket(
    tournament_uuid UUID,
    groups_count INTEGER DEFAULT 4
)
RETURNS VOID AS $$
DECLARE
    confirmed_pairs RECORD;
    num_pairs INTEGER;
    pairs_per_group INTEGER;
    current_group INTEGER;
    pair_index INTEGER;
BEGIN
    -- Get confirmed pairs (player + partner registrations)
    SELECT COUNT(*) INTO num_pairs
    FROM tournament_registrations
    WHERE tournament_id = tournament_uuid AND status = 'confirmed';
    
    -- Calculate pairs per group
    pairs_per_group := CEIL(num_pairs::FLOAT / groups_count);
    
    -- Create group matches
    FOR current_group IN 1..groups_count LOOP
        FOR pair_index IN 1..pairs_per_group LOOP
            -- Create round-robin matches within each group
            INSERT INTO tournament_matches (
                tournament_id,
                round,
                match_number,
                bracket_position,
                status
            ) VALUES (
                tournament_uuid,
                1, -- Group stage
                (current_group - 1) * pairs_per_group + pair_index,
                'G' || current_group || '-M' || pair_index,
                'pending'
            );
        END LOOP;
    END LOOP;
    
    -- Create semifinals for group winners
    INSERT INTO tournament_matches (tournament_id, round, match_number, bracket_position, status)
    VALUES 
        (tournament_uuid, 2, 1, 'SF-1', 'pending'),
        (tournament_uuid, 2, 2, 'SF-2', 'pending');
    
    -- Create final
    INSERT INTO tournament_matches (tournament_id, round, match_number, bracket_position, status)
    VALUES (tournament_uuid, 3, 1, 'F', 'pending');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tournaments_gender ON tournaments(gender);
CREATE INDEX IF NOT EXISTS idx_tournaments_format_type ON tournaments(format_type);
CREATE INDEX IF NOT EXISTS idx_tournaments_eligible_categories ON tournaments USING GIN(eligible_categories);
CREATE INDEX IF NOT EXISTS idx_intercountry_participants_list_manager ON intercountry_participants(list_manager_id);
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender) WHERE status = 'active';

-- ============================================
-- 8. FIX EXISTING DATA
-- ============================================

-- Update existing tournaments to have default values
UPDATE tournaments SET gender = 'mixed' WHERE gender IS NULL;
UPDATE tournaments SET format_type = type WHERE format_type IS NULL;

COMMENT ON COLUMN tournaments.gender IS 'Tournament gender category: male, female, or mixed';
COMMENT ON COLUMN tournaments.format_type IS 'Tournament format: single_elimination, double_elimination, round_robin, swiss, americano, liga';
COMMENT ON COLUMN tournaments.duration_hours IS 'Estimated duration of the tournament in hours';
COMMENT ON COLUMN tournaments.eligible_categories IS 'Array of player categories allowed to participate (NULL = all)';
COMMENT ON COLUMN intercountry_participants.list_manager_id IS 'User assigned to manage the good-faith player list for this club in the tournament';
