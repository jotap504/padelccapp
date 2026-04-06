-- Simple debug policy for intercountry_registrations
-- This should allow any admin to insert

-- Drop all existing policies first
DROP POLICY IF EXISTS intercountry_registrations_insert_manager ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable insert for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable delete for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable all updates for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable position updates for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "intercountry_registrations_insert" ON intercountry_registrations;
DROP POLICY IF EXISTS "intercountry_registrations_update" ON intercountry_registrations;
DROP POLICY IF EXISTS "intercountry_registrations_delete" ON intercountry_registrations;

-- Simple policy: Allow any authenticated user to insert (for testing)
CREATE POLICY "intercountry_registrations_insert_debug" ON intercountry_registrations
FOR INSERT TO authenticated 
WITH CHECK (true);

-- Simple policy: Allow any authenticated user to update (for testing)
CREATE POLICY "intercountry_registrations_update_debug" ON intercountry_registrations
FOR UPDATE TO authenticated 
USING (true)
WITH CHECK (true);

-- Simple policy: Allow any authenticated user to delete (for testing)
CREATE POLICY "intercountry_registrations_delete_debug" ON intercountry_registrations
FOR DELETE TO authenticated 
USING (true);
