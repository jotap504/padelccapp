-- ============================================================================
-- SETUP INICIAL - EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================================
-- PASO 1: Crear tablas, RLS, triggers (ya está en 001_initial_schema.sql)
-- PASO 2: Insertar datos demo
-- ============================================================================

-- Crear club demo
INSERT INTO public.clubs (name, slug) 
VALUES ('Club Demo', 'demo-club')
ON CONFLICT (slug) DO NOTHING;

-- Obtener ID del club demo
DO $$
DECLARE
    v_club_id UUID;
BEGIN
    SELECT id INTO v_club_id FROM public.clubs WHERE slug = 'demo-club';
    
    -- Crear usuario admin de ejemplo
    INSERT INTO public.users (
        club_id, 
        name, 
        email, 
        member_number, 
        gender,
        category,
        rating,
        initial_category,
        password_hash,
        status,
        imported_from_csv,
        auth_provider
    ) VALUES (
        v_club_id,
        'Administrador Demo',
        'admin@demo.com',
        'ADMIN001',
        'M',
        5,
        850,
        5,
        crypt('100', gen_salt('bf')),
        'active',
        false,
        'email'
    )
    ON CONFLICT (club_id, member_number) DO NOTHING;
    
    -- Crear jugadores de ejemplo (importados desde CSV)
    INSERT INTO public.users (
        club_id, 
        name, 
        gender,
        member_number,
        category,
        rating,
        initial_category,
        password_hash,
        status,
        imported_from_csv,
        auth_provider
    ) VALUES 
        (v_club_id, 'Juan Pérez', 'M', '10001', 5, 850, 5, crypt('100', gen_salt('bf')), 'active', true, 'imported'),
        (v_club_id, 'María García', 'F', '10002', 6, 750, 6, crypt('100', gen_salt('bf')), 'active', true, 'imported'),
        (v_club_id, 'Carlos López', 'M', '10003', 4, 950, 4, crypt('100', gen_salt('bf')), 'active', true, 'imported'),
        (v_club_id, 'Ana Martínez', 'F', '10004', 5, 850, 5, crypt('100', gen_salt('bf')), 'active', true, 'imported'),
        (v_club_id, 'Pedro Rodríguez', 'M', '10005', 6, 750, 6, crypt('100', gen_salt('bf')), 'active', true, 'imported'),
        (v_club_id, 'Laura Sánchez', 'F', '10006', 7, 650, 7, crypt('100', gen_salt('bf')), 'active', true, 'imported')
    ON CONFLICT (club_id, member_number) DO NOTHING;
    
    RAISE NOTICE 'Setup completado. Club ID: %', v_club_id;
END $$;

-- Verificar datos insertados
SELECT 
    c.name as club_name,
    c.slug,
    COUNT(u.id) as total_jugadores
FROM public.clubs c
LEFT JOIN public.users u ON u.club_id = c.id
WHERE c.slug = 'demo-club'
GROUP BY c.id, c.name, c.slug;
