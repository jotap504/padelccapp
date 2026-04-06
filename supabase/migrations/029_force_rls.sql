-- Check and fix RLS for intercountry_registrations

-- Enable RLS if not enabled
ALTER TABLE intercountry_registrations ENABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS intercountry_registrations_insert_manager ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable insert for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable delete for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable all updates for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "Enable position updates for admin and captain" ON intercountry_registrations;
DROP POLICY IF EXISTS "intercountry_registrations_insert" ON intercountry_registrations;
DROP POLICY IF EXISTS "intercountry_registrations_update" ON intercountry_registrations;
DROP POLICY IF EXISTS "intercountry_registrations_delete" ON intercountry_registrations;
DROP POLICY IF EXISTS "intercountry_registrations_insert_debug" ON intercountry_registrations;
DROP POLICY IF EXISTS "intercountry_registrations_update_debug" ON intercountry_registrations;
DROP POLICY IF EXISTS "intercountry_registrations_delete_debug" ON intercountry_registrations;

-- Allow any authenticated user to do everything (temporary fix)
CREATE POLICY "intercountry_registrations_all" ON intercountry_registrations
FOR ALL TO authenticated 
USING (true)
WITH CHECK (true);

-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'intercountry_registrations';
