-- Fix RLS issues by adding SECURITY DEFINER to notification functions
-- SECURITY DEFINER allows the function to execute with the privileges of the owner
-- which bypasses RLS policies

-- Fix notify_match_created function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION notify_match_created()
RETURNS TRIGGER AS $$
DECLARE
    player RECORD;
    creator_name TEXT;
BEGIN
    -- Obtener nombre del creador
    SELECT name INTO creator_name FROM users WHERE id = NEW.created_by;
    
    -- Notificar a cada jugador del partido
    FOR player IN 
        SELECT (elem->>'user_id')::text as user_id 
        FROM jsonb_array_elements(NEW.team_a || NEW.team_b) AS elem
        WHERE (elem->>'user_id')::text != NEW.created_by::text
    LOOP
        INSERT INTO notifications (
            user_id,
            club_id,
            type,
            title,
            message,
            data,
            action_url,
            action_text
        ) VALUES (
            player.user_id::uuid,
            NEW.club_id,
            'match_created',
            'Nuevo Partido',
            creator_name || ' te invitó a jugar un partido el ' || to_char(NEW.date::timestamp, 'DD/MM/YYYY'),
            jsonb_build_object('match_id', NEW.id),
            '/matches/' || NEW.id,
            'Ver Partido'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix notify_match_result_entered function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION notify_match_result_entered()
RETURNS TRIGGER AS $$
DECLARE
    player RECORD;
    enterer_name TEXT;
    other_team jsonb;
BEGIN
    -- Solo si el status cambió a pending (resultado cargado)
    IF OLD.status = 'pending' OR NEW.status != 'pending' THEN
        RETURN NEW;
    END IF;
    
    -- Obtener nombre de quien cargó el resultado
    SELECT name INTO enterer_name 
    FROM users 
    WHERE id = (NEW.validated_by->>0)::uuid;
    
    -- Notificar a jugadores del otro equipo
    FOR player IN 
        SELECT (elem->>'user_id')::text as user_id 
        FROM jsonb_array_elements(NEW.team_b) AS elem
        WHERE NOT ((elem->>'user_id')::text = ANY(ARRAY(SELECT jsonb_array_elements_text(NEW.validated_by))))
    LOOP
        INSERT INTO notifications (
            user_id,
            club_id,
            type,
            title,
            message,
            data,
            action_url,
            action_text
        ) VALUES (
            player.user_id::uuid,
            NEW.club_id,
            'match_validation_needed',
            'Validar Resultado',
            enterer_name || ' cargó el resultado del partido. Validá para confirmar.',
            jsonb_build_object('match_id', NEW.id),
            '/matches/' || NEW.id,
            'Validar'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
