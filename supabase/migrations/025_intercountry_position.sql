-- Add position column to intercountry_registrations for "Lista de Buena Fe"
ALTER TABLE IF EXISTS intercountry_registrations 
ADD COLUMN IF NOT EXISTS position INTEGER CHECK (position >= 1 AND position <= 20);

-- Add index for efficient ordering by position
CREATE INDEX IF NOT EXISTS idx_intercountry_registrations_position 
ON intercountry_registrations(tournament_id, club_id, position);

-- Drop existing policy if exists and create new one
DO $$
BEGIN
    DROP POLICY IF EXISTS "Enable position updates for admin and captain" ON intercountry_registrations;
    
    CREATE POLICY "Enable position updates for admin and captain" 
    ON intercountry_registrations 
    FOR UPDATE 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM intercountry_participants ip
        WHERE ip.tournament_id = intercountry_registrations.tournament_id
        AND ip.club_id = intercountry_registrations.club_id
        AND (
          ip.list_manager_id = auth.uid() 
          OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
          )
        )
      )
    );
END $$;
