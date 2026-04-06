-- Add RLS policies for INSERT and DELETE on intercountry_registrations

-- Enable INSERT for captains and admins
CREATE POLICY "Enable insert for admin and captain" 
ON intercountry_registrations 
FOR INSERT 
TO authenticated 
WITH CHECK (
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

-- Enable DELETE for captains and admins  
CREATE POLICY "Enable delete for admin and captain" 
ON intercountry_registrations 
FOR DELETE 
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

-- Enable UPDATE for all fields (including captain updates)
DROP POLICY IF EXISTS "Enable position updates for admin and captain" ON intercountry_registrations;

CREATE POLICY "Enable all updates for admin and captain" 
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
)
WITH CHECK (
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
