-- ============================================
-- SISTEMA DE CHAT ENTRE JUGADORES
-- ============================================

-- Tabla de conversaciones/chats
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- Tipo de conversación
    type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'match', 'tournament', 'league')),
    
    -- Para grupos
    name TEXT,
    description TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES users(id),
    
    -- Si está relacionada a algo específico
    related_match_id UUID REFERENCES matches(id),
    related_tournament_id UUID REFERENCES tournaments(id),
    related_league_id UUID REFERENCES leagues(id),
    
    -- Configuración
    is_group BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false, -- Visible para todo el club
    
    -- Metadata
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    message_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de participantes de conversaciones
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Rol en el grupo (si aplica)
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    
    -- Notificaciones
    notifications_enabled BOOLEAN DEFAULT true,
    
    -- Estado de lectura
    last_read_at TIMESTAMPTZ,
    unread_count INTEGER DEFAULT 0,
    
    -- Estados
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    
    UNIQUE(conversation_id, user_id)
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    
    -- Contenido
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'file', 'voice', 'location', 'system')),
    
    -- Metadata del contenido
    metadata JSONB, -- {file_name, file_size, file_url, etc.}
    
    -- Mensaje al que responde (threading)
    reply_to_id UUID REFERENCES messages(id),
    
    -- Reacciones (emojis)
    reactions JSONB DEFAULT '[]', -- [{user_id, emoji, created_at}, ...]
    
    -- Estados
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Para borrado lógico
    deleted_reason TEXT
);

-- Tabla de adjuntos/archivos
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    
    -- Para imágenes
    thumbnail_url TEXT,
    width INTEGER,
    height INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_conversations_club ON conversations(club_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_unread ON conversation_participants(user_id, unread_count);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- ============================================
-- VISTAS
-- ============================================

-- Vista de conversaciones con info de participantes
CREATE VIEW user_conversations AS
SELECT 
    c.id,
    c.club_id,
    c.type,
    c.name,
    c.description,
    c.avatar_url,
    c.is_group,
    c.is_public,
    c.last_message_at,
    c.last_message_preview,
    c.message_count,
    c.created_at,
    cp.user_id as current_user_id,
    cp.role as user_role,
    cp.notifications_enabled,
    cp.last_read_at,
    cp.unread_count,
    cp.is_active,
    -- Otros participantes (para chats directos)
    CASE 
        WHEN c.is_group = false THEN (
            SELECT u.name 
            FROM conversation_participants cp2
            JOIN users u ON cp2.user_id = u.id
            WHERE cp2.conversation_id = c.id 
            AND cp2.user_id != cp.user_id
            LIMIT 1
        )
        ELSE NULL
    END as other_participant_name
FROM conversations c
JOIN conversation_participants cp ON c.id = cp.conversation_id
WHERE cp.is_active = true;

-- ============================================
-- FUNCIONES
-- ============================================

-- Función para crear chat directo entre dos usuarios
CREATE OR REPLACE FUNCTION create_direct_conversation(
    p_club_id UUID,
    p_user_a UUID,
    p_user_b UUID
)
RETURNS UUID AS $$
DECLARE
    conv_id UUID;
    existing_conv UUID;
BEGIN
    -- Verificar si ya existe conversación directa entre estos usuarios
    SELECT c.id INTO existing_conv
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = p_user_a
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = p_user_b
    WHERE c.is_group = false
    AND c.club_id = p_club_id
    LIMIT 1;
    
    IF existing_conv IS NOT NULL THEN
        RETURN existing_conv;
    END IF;
    
    -- Crear conversación
    INSERT INTO conversations (club_id, type, is_group)
    VALUES (p_club_id, 'direct', false)
    RETURNING id INTO conv_id;
    
    -- Agregar participantes
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES 
        (conv_id, p_user_a),
        (conv_id, p_user_b);
    
    RETURN conv_id;
END;
$$ LANGUAGE plpgsql;

-- Función para crear grupo
CREATE OR REPLACE FUNCTION create_group_conversation(
    p_club_id UUID,
    p_created_by UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_participants UUID[] DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    conv_id UUID;
    participant UUID;
BEGIN
    -- Crear conversación
    INSERT INTO conversations (
        club_id, 
        type, 
        name, 
        description, 
        is_group, 
        is_public,
        created_by
    ) VALUES (
        p_club_id,
        'group',
        p_name,
        p_description,
        true,
        false,
        p_created_by
    )
    RETURNING id INTO conv_id;
    
    -- Agregar creador como admin
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (conv_id, p_created_by, 'admin');
    
    -- Agregar otros participantes
    FOREACH participant IN ARRAY p_participants
    LOOP
        IF participant != p_created_by THEN
            INSERT INTO conversation_participants (conversation_id, user_id)
            VALUES (conv_id, participant);
        END IF;
    END LOOP;
    
    RETURN conv_id;
END;
$$ LANGUAGE plpgsql;

-- Función para enviar mensaje
CREATE OR REPLACE FUNCTION send_message(
    p_conversation_id UUID,
    p_sender_id UUID,
    p_content TEXT,
    p_content_type TEXT DEFAULT 'text',
    p_metadata JSONB DEFAULT NULL,
    p_reply_to_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    msg_id UUID;
    conv_club_id UUID;
BEGIN
    -- Verificar que el remitente esté en la conversación
    IF NOT EXISTS (
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = p_conversation_id
        AND user_id = p_sender_id
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para enviar mensajes en esta conversación';
    END IF;
    
    -- Obtener club_id
    SELECT club_id INTO conv_club_id FROM conversations WHERE id = p_conversation_id;
    
    -- Crear mensaje
    INSERT INTO messages (
        conversation_id,
        sender_id,
        content,
        content_type,
        metadata,
        reply_to_id
    ) VALUES (
        p_conversation_id,
        p_sender_id,
        p_content,
        p_content_type,
        p_metadata,
        p_reply_to_id
    )
    RETURNING id INTO msg_id;
    
    -- Actualizar conversación
    UPDATE conversations
    SET 
        last_message_at = NOW(),
        last_message_preview = LEFT(p_content, 100),
        message_count = message_count + 1
    WHERE id = p_conversation_id;
    
    -- Actualizar unread_count para otros participantes
    UPDATE conversation_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = p_conversation_id
    AND user_id != p_sender_id
    AND is_active = true;
    
    -- Crear notificaciones
    INSERT INTO notifications (user_id, club_id, type, title, message, data)
    SELECT 
        cp.user_id,
        conv_club_id,
        'general',
        'Nuevo mensaje',
        (SELECT name FROM users WHERE id = p_sender_id) || ': ' || LEFT(p_content, 50),
        jsonb_build_object(
            'conversation_id', p_conversation_id,
            'message_id', msg_id,
            'sender_id', p_sender_id
        )
    FROM conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
    AND cp.user_id != p_sender_id
    AND cp.notifications_enabled = true
    AND cp.is_active = true;
    
    RETURN msg_id;
END;
$$ LANGUAGE plpgsql;

-- Función para marar mensajes como leídos
CREATE OR REPLACE FUNCTION mark_conversation_read(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS void AS $$
BEGIN
    UPDATE conversation_participants
    SET 
        last_read_at = NOW(),
        unread_count = 0
    WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Función para agregar reacción
CREATE OR REPLACE FUNCTION add_reaction(
    p_message_id UUID,
    p_user_id UUID,
    p_emoji TEXT
)
RETURNS void AS $$
BEGIN
    UPDATE messages
    SET reactions = reactions || jsonb_build_object(
        'user_id', p_user_id,
        'emoji', p_emoji,
        'created_at', NOW()
    )
    WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Función para actualizar timestamp de conversación
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp de conversación
DROP TRIGGER IF EXISTS update_conversation_timestamp ON conversations;
CREATE TRIGGER update_conversation_timestamp
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

-- Trigger para marcar mensaje como editado
CREATE OR REPLACE FUNCTION mark_message_edited()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content != NEW.content THEN
        NEW.is_edited = true;
        NEW.edited_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mark_message_edited ON messages;
CREATE TRIGGER mark_message_edited
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION mark_message_edited();

-- ============================================
-- DATOS DE PRUEBA
-- ============================================

-- Crear chat de grupo general del club
INSERT INTO conversations (club_id, type, name, description, is_group, is_public, created_by)
SELECT 
    c.id,
    'group',
    'Chat General ' || c.name,
    'Chat grupal para todos los miembros del club',
    true,
    true,
    (SELECT id FROM users WHERE club_id = c.id LIMIT 1)
FROM clubs c
WHERE EXISTS (SELECT 1 FROM users WHERE club_id = c.id)
ON CONFLICT DO NOTHING;
