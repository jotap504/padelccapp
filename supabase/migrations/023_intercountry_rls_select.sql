-- Add missing RLS SELECT policy for intercountry_tournaments
-- This fixes the 400 error when querying the table

-- Enable RLS on the table (if not already enabled)
ALTER TABLE intercountry_tournaments ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view intercountry tournaments
DROP POLICY IF EXISTS intercountry_tournaments_select ON intercountry_tournaments;
CREATE POLICY intercountry_tournaments_select ON intercountry_tournaments
    FOR SELECT USING (true);

-- Also add policies for intercountry_participants and intercountry_registrations
ALTER TABLE intercountry_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE intercountry_registrations ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view participants
DROP POLICY IF EXISTS intercountry_participants_select ON intercountry_participants;
CREATE POLICY intercountry_participants_select ON intercountry_participants
    FOR SELECT USING (true);

-- Policy: Everyone can view registrations
DROP POLICY IF EXISTS intercountry_registrations_select ON intercountry_registrations;
CREATE POLICY intercountry_registrations_select ON intercountry_registrations
    FOR SELECT USING (true);
