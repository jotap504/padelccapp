-- ============================================
-- SISTEMA DE NOTIFICACIONES
-- ============================================

-- Agregar columnas faltantes a la tabla existente
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_text TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Actualizar constraint de type si es necesario
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'match_created', 'match_result_entered', 'match_validation_needed', 'match_confirmed',
    'tournament_registration', 'tournament_starting', 'tournament_match',
    'availability_match', 'intercountry_match', 'ranking_changed', 'general',
    'whatsapp', 'push', 'email'
));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
DROP INDEX IF EXISTS idx_notifications_user_read;
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Vista de notificaciones no leídas por usuario
DROP VIEW IF EXISTS unread_notifications;
CREATE VIEW unread_notifications AS
SELECT 
    n.*,
    u.name as user_name
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.is_read = false
AND (n.expires_at IS NULL OR n.expires_at > NOW());

-- ============================================
-- FUNCIONES PARA CREAR NOTIFICACIONES
-- ============================================

-- Función para notificar a jugadores de un partido nuevo
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
$$ LANGUAGE plpgsql;

-- Trigger para notificar cuando se crea un partido
CREATE TRIGGER notify_match_created_trigger
    AFTER INSERT ON matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_match_created();

-- Función para notificar cuando se carga un resultado
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
$$ LANGUAGE plpgsql;

-- Trigger para notificar cuando se carga resultado
DROP TRIGGER IF EXISTS notify_match_result_trigger ON matches;
CREATE TRIGGER notify_match_result_trigger
    AFTER UPDATE ON matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_match_result_entered();

-- Función para notificar cambios de ranking
CREATE OR REPLACE FUNCTION notify_ranking_change()
RETURNS TRIGGER AS $$
DECLARE
    position_change INTEGER;
    old_rating DECIMAL;
    message TEXT;
BEGIN
    -- Obtener rating anterior
    SELECT rating_after INTO old_rating
    FROM ranking_history
    WHERE user_id = NEW.user_id
    AND created_at < NEW.created_at
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF old_rating IS NOT NULL THEN
        IF NEW.rating_after > old_rating THEN
            message := '¡Subiste de rating! ' || old_rating || ' → ' || NEW.rating_after || ' (+' || (NEW.rating_after - old_rating) || ')';
        ELSE
            message := 'Bajaste de rating: ' || old_rating || ' → ' || NEW.rating_after || ' (' || (NEW.rating_after - old_rating) || ')';
        END IF;
        
        INSERT INTO notifications (
            user_id,
            club_id,
            type,
            title,
            message,
            data,
            is_important,
            action_url
        ) VALUES (
            NEW.user_id,
            NEW.club_id,
            'ranking_changed',
            'Cambio en tu Ranking',
            message,
            jsonb_build_object(
                'rating_before', old_rating,
                'rating_after', NEW.rating_after,
                'delta', NEW.delta,
                'match_id', NEW.match_id
            ),
            true,
            '/players/' || NEW.user_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificar cambios de ranking
DROP TRIGGER IF EXISTS notify_ranking_change_trigger ON ranking_history;
CREATE TRIGGER notify_ranking_change_trigger
    AFTER INSERT ON ranking_history
    FOR EACH ROW
    EXECUTE FUNCTION notify_ranking_change();

-- Función para marcar notificación como leída
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications 
    SET is_read = true, read_at = NOW()
    WHERE id = notification_id 
    AND user_id = user_id
    AND is_read = false;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DATOS DE PRUEBA
-- ============================================

-- Insertar algunas notificaciones de ejemplo
INSERT INTO notifications (user_id, club_id, type, template, title, message, is_read, action_url, action_text)
SELECT 
    u.id,
    u.club_id,
    'general',
    'welcome',
    'Bienvenido a PádelCC!',
    'Ya podés empezar a usar todas las funciones de la app.',
    false,
    '/dashboard',
    'Ir al Dashboard'
FROM users u
WHERE u.status = 'active'
LIMIT 5;
