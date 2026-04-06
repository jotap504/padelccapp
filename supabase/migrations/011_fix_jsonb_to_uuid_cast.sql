-- Fix: cannot cast type jsonb to uuid error in update_user_stats_after_match function
-- The issue is that casting (elem->>'user_id')::UUID directly from jsonb doesn't work reliably
-- We need to cast to text first, then to uuid

CREATE OR REPLACE FUNCTION public.update_user_stats_after_match()
RETURNS TRIGGER AS $$
DECLARE
    player_record RECORD;
    player_id UUID;
BEGIN
    -- Solo procesar si el partido fue confirmado
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        -- Actualizar total_matches y win_rate para todos los jugadores del partido
        
        -- Jugadores de team_a
        FOR player_record IN 
            SELECT (elem->>'user_id')::text::UUID as uid 
            FROM jsonb_array_elements(NEW.team_a) AS elem
        LOOP
            UPDATE public.users 
            SET total_matches = total_matches + 1,
                win_rate = public.calculate_win_rate(player_record.uid),
                ranking_confidence = ranking_confidence + 1
            WHERE id = player_record.uid;
        END LOOP;
        
        -- Jugadores de team_b
        FOR player_record IN 
            SELECT (elem->>'user_id')::text::UUID as uid 
            FROM jsonb_array_elements(NEW.team_b) AS elem
        LOOP
            UPDATE public.users 
            SET total_matches = total_matches + 1,
                win_rate = public.calculate_win_rate(player_record.uid),
                ranking_confidence = ranking_confidence + 1
            WHERE id = player_record.uid;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
