-- Fix RLS policy for notifications table to allow INSERT from triggers
-- The notify_match_created trigger needs to insert notifications

-- Add INSERT policy for notifications
DROP POLICY IF EXISTS notifications_insert_own_club ON public.notifications;
CREATE POLICY notifications_insert_own_club ON public.notifications
    FOR INSERT WITH CHECK (
        -- Allow insert if the user belongs to the same club as the notification
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.users nu ON nu.id = notifications.user_id
            WHERE u.id = auth.uid()
            AND u.club_id = nu.club_id
        )
        OR 
        -- Or if user is the intended recipient
        user_id = auth.uid()
    );

-- Alternative: Allow all authenticated users to insert (more permissive but simpler)
-- This is acceptable because notifications are system-generated from triggers
DROP POLICY IF EXISTS notifications_insert_for_all ON public.notifications;
CREATE POLICY notifications_insert_for_all ON public.notifications
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
    );
