-- Fix RLS policies for intercountry_registrations
-- Drop all existing policies and recreate them correctly

-- Drop existing policies
DROP POLICY IF EXISTS intercountry_registrations_insert_manager ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable insert for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable delete for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable all updates for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable position updates for admin and captain" ON intercountry_registrations;

-- Create unified INSERT policy for admins and captains
CREATE POLICY "intercountry_registrations_insert" ON intercountry_registrations
FOR INSERT TO authenticated 
WITH CHECK (
  -- Superadmin can insert anywhere
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  OR (
    -- Admin can insert for their club
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' 
           AND club_id = intercountry_registrations.club_id)
  )
  OR (
    -- Captain can insert if they are the list_manager
    EXISTS (
      SELECT 1 FROM intercountry_participants 
      WHERE tournament_id = intercountry_registrations.tournament_id 
      AND club_id = intercountry_registrations.club_id
      AND list_manager_id = auth.uid()
    )
  )
);

-- Create unified UPDATE policy
CREATE POLICY "intercountry_registrations_update" ON intercountry_registrations
FOR UPDATE TO authenticated 
USING (
  -- Superadmin can update anything
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  OR (
    -- Admin can update their club's registrations
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' 
           AND club_id = intercountry_registrations.club_id)
  )
  OR (
    -- Captain can update if they are the list_manager
    EXISTS (
      SELECT 1 FROM intercountry_participants 
      WHERE tournament_id = intercountry_registrations.tournament_id 
      AND club_id = intercountry_registrations.club_id
      AND list_manager_id = auth.uid()
    )
  )
)
WITH CHECK (
  -- Same conditions for WITH CHECK
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  OR (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' 
           AND club_id = intercountry_registrations.club_id)
  )
  OR (
    EXISTS (
      SELECT 1 FROM intercountry_participants 
      WHERE tournament_id = intercountry_registrations.tournament_id 
      AND club_id = intercountry_registrations.club_id
      AND list_manager_id = auth.uid()
    )
  )
);

-- Create unified DELETE policy
CREATE POLICY "intercountry_registrations_delete" ON intercountry_registrations
FOR DELETE TO authenticated 
USING (
  -- Superadmin can delete anything
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
  OR (
    -- Admin can delete their club's registrations
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' 
           AND club_id = intercountry_registrations.club_id)
  )
  OR (
    -- Captain can delete if they are the list_manager
    EXISTS (
      SELECT 1 FROM intercountry_participants 
      WHERE tournament_id = intercountry_registrations.tournament_id 
      AND club_id = intercountry_registrations.club_id
      AND list_manager_id = auth.uid()
    )
  )
);
