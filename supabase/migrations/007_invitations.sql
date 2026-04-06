-- ============================================
-- SISTEMA DE INVITACIONES DE JUGADORES
-- ============================================

-- Tabla de invitaciones
CREATE TABLE IF NOT EXISTS player_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- Quien invita
    invited_by UUID NOT NULL REFERENCES users(id),
    
    -- Datos del invitado
    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    category INTEGER,
    
    -- Estado de la invitación
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    
    -- Token único para aceptar la invitación
    token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    
    -- Usuario creado (cuando acepta)
    created_user_id UUID REFERENCES users(id),
    
    -- Fechas
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    UNIQUE(club_id, email)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invitations_token ON player_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON player_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_club ON player_invitations(club_id);

-- Vista de invitaciones pendientes
CREATE VIEW pending_invitations AS
SELECT 
    pi.*,
    c.name as club_name,
    u.name as invited_by_name
FROM player_invitations pi
JOIN clubs c ON pi.club_id = c.id
JOIN users u ON pi.invited_by = u.id
WHERE pi.status = 'pending' AND pi.expires_at > NOW();

-- Función para crear invitación
CREATE OR REPLACE FUNCTION create_player_invitation(
    p_club_id UUID,
    p_invited_by UUID,
    p_email TEXT,
    p_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_category INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    existing_user UUID;
BEGIN
    -- Verificar si el email ya existe en el club
    SELECT id INTO existing_user
    FROM users
    WHERE email = p_email AND club_id = p_club_id;
    
    IF existing_user IS NOT NULL THEN
        RAISE EXCEPTION 'El email ya está registrado en este club';
    END IF;
    
    -- Verificar si ya hay una invitación pendiente
    IF EXISTS (SELECT 1 FROM player_invitations WHERE email = p_email AND club_id = p_club_id AND status = 'pending') THEN
        RAISE EXCEPTION 'Ya existe una invitación pendiente para este email';
    END IF;
    
    -- Crear invitación
    INSERT INTO player_invitations (
        club_id,
        invited_by,
        email,
        name,
        phone,
        category
    ) VALUES (
        p_club_id,
        p_invited_by,
        p_email,
        p_name,
        p_phone,
        p_category
    )
    RETURNING id INTO new_id;
    
    -- Crear notificación para el invitador
    INSERT INTO notifications (
        user_id,
        club_id,
        type,
        title,
        message,
        action_url
    ) VALUES (
        p_invited_by,
        p_club_id,
        'general',
        'Invitación Enviada',
        'Se envió una invitación a ' || p_email,
        '/admin/invitations'
    );
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Función para aceptar invitación
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    club_id UUID,
    club_name TEXT
) AS $$
DECLARE
    inv_record RECORD;
    new_user_id UUID;
BEGIN
    -- Buscar invitación
    SELECT * INTO inv_record
    FROM player_invitations
    WHERE token = p_token AND status = 'pending' AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Invitación no encontrada o expirada', NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;
    
    -- Crear usuario (en un flujo real, esto iría acompañado de seteo de password)
    INSERT INTO users (
        club_id,
        email,
        name,
        phone,
        category,
        status,
        role
    ) VALUES (
        inv_record.club_id,
        inv_record.email,
        COALESCE(inv_record.name, split_part(inv_record.email, '@', 1)),
        inv_record.phone,
        COALESCE(inv_record.category, 4),
        'active',
        'player'
    )
    RETURNING id INTO new_user_id;
    
    -- Actualizar invitación
    UPDATE player_invitations
    SET 
        status = 'accepted',
        created_user_id = new_user_id,
        accepted_at = NOW()
    WHERE id = inv_record.id;
    
    -- Notificar al invitador
    INSERT INTO notifications (
        user_id,
        club_id,
        type,
        title,
        message
    ) VALUES (
        inv_record.invited_by,
        inv_record.club_id,
        'general',
        'Invitación Aceptada',
        COALESCE(inv_record.name, inv_record.email) || ' aceptó tu invitación'
    );
    
    RETURN QUERY SELECT 
        true, 
        'Invitación aceptada correctamente', 
        inv_record.club_id,
        (SELECT name FROM clubs WHERE id = inv_record.club_id);
END;
$$ LANGUAGE plpgsql;

-- Trigger para expirar invitaciones automáticamente
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
    UPDATE player_invitations
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Job para expirar invitaciones (ejecutar diariamente)
-- SELECT cron.schedule('expire-invitations', '0 0 * * *', 'SELECT expire_old_invitations()');
