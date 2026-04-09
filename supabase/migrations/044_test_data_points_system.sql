-- =====================================================
-- SCRIPT COMPLETO DE PRUEBA: Sistema de Puntos y Ascensos
-- =====================================================

-- 1. BORRAR TODOS LOS PARTIDOS EXISTENTES
-- =====================================================
DELETE FROM matches WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3';

-- Verificar que se borraron
SELECT 'Partidos borrados' as estado, COUNT(*) as total FROM matches WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3';

-- 2. CREAR JUGADORES DE PRUEBA
-- =====================================================
-- Primero, verificar cuántos usuarios tenemos actualmente
SELECT 'Usuarios actuales' as estado, COUNT(*) as total FROM users WHERE role = 'user' OR role IS NULL;

-- Insertar jugadores hombres categoría 4 (alta categoría, buenos jugadores)
INSERT INTO users (id, name, email, role, club_id, category, rating, gender, total_matches, win_rate, created_at) VALUES
(gen_random_uuid(), 'Martín Rodríguez', 'martin.r@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 4, 0, 'M', 0, 0, NOW()),
(gen_random_uuid(), 'Diego Fernández', 'diego.f@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 4, 0, 'M', 0, 0, NOW()),
(gen_random_uuid(), 'Lucas Martínez', 'lucas.m@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 4, 0, 'M', 0, 0, NOW()),
(gen_random_uuid(), 'Nicolás García', 'nicolas.g@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 4, 0, 'M', 0, 0, NOW())
ON CONFLICT DO NOTHING;

-- Insertar jugadores hombres categoría 5 (categoría media)
INSERT INTO users (id, name, email, role, club_id, category, rating, gender, total_matches, win_rate, created_at) VALUES
(gen_random_uuid(), 'Carlos López', 'carlos.l@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 5, 0, 'M', 0, 0, NOW()),
(gen_random_uuid(), 'Juan Pérez', 'juan.p@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 5, 0, 'M', 0, 0, NOW()),
(gen_random_uuid(), 'Andrés Silva', 'andres.s@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 5, 0, 'M', 0, 0, NOW()),
(gen_random_uuid(), 'Facundo Torres', 'facundo.t@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 5, 0, 'M', 0, 0, NOW())
ON CONFLICT DO NOTHING;

-- Insertar jugadores hombres categoría 6 (categoría principiante)
INSERT INTO users (id, name, email, role, club_id, category, rating, gender, total_matches, win_rate, created_at) VALUES
(gen_random_uuid(), 'Pedro Gómez', 'pedro.g@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 6, 0, 'M', 0, 0, NOW()),
(gen_random_uuid(), 'Santiago Ruiz', 'santiago.r@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 6, 0, 'M', 0, 0, NOW()),
(gen_random_uuid(), 'Matías Castro', 'matias.c@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 6, 0, 'M', 0, 0, NOW()),
(gen_random_uuid(), 'Tomás Vargas', 'tomas.v@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 6, 0, 'M', 0, 0, NOW())
ON CONFLICT DO NOTHING;

-- Insertar jugadoras mujeres categoría 4 (alta categoría)
INSERT INTO users (id, name, email, role, club_id, category, rating, gender, total_matches, win_rate, created_at) VALUES
(gen_random_uuid(), 'María González', 'maria.g@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 4, 0, 'F', 0, 0, NOW()),
(gen_random_uuid(), 'Laura Benítez', 'laura.b@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 4, 0, 'F', 0, 0, NOW()),
(gen_random_uuid(), 'Carolina Díaz', 'carolina.d@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 4, 0, 'F', 0, 0, NOW()),
(gen_random_uuid(), 'Valentina Ruiz', 'valentina.r@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 4, 0, 'F', 0, 0, NOW())
ON CONFLICT DO NOTHING;

-- Insertar jugadoras mujeres categoría 5 (categoría media)
INSERT INTO users (id, name, email, role, club_id, category, rating, gender, total_matches, win_rate, created_at) VALUES
(gen_random_uuid(), 'Ana Martínez', 'ana.m@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 5, 0, 'F', 0, 0, NOW()),
(gen_random_uuid(), 'Lucía Herrera', 'lucia.h@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 5, 0, 'F', 0, 0, NOW()),
(gen_random_uuid(), 'Florencia Sosa', 'florencia.s@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 5, 0, 'F', 0, 0, NOW()),
(gen_random_uuid(), 'Camila Torres', 'camila.t@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 5, 0, 'F', 0, 0, NOW())
ON CONFLICT DO NOTHING;

-- Insertar jugadoras mujeres categoría 6 (categoría principiante)
INSERT INTO users (id, name, email, role, club_id, category, rating, gender, total_matches, win_rate, created_at) VALUES
(gen_random_uuid(), 'Sofía Castro', 'sofia.c@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 6, 0, 'F', 0, 0, NOW()),
(gen_random_uuid(), 'Julieta Vargas', 'julieta.v@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 6, 0, 'F', 0, 0, NOW()),
(gen_random_uuid(), 'Victoria Luna', 'victoria.l@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 6, 0, 'F', 0, 0, NOW()),
(gen_random_uuid(), 'Paula Mendoza', 'paula.m@test.com', 'user', '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 6, 0, 'F', 0, 0, NOW())
ON CONFLICT DO NOTHING;

-- Verificar jugadores creados
SELECT category, gender, COUNT(*) as total 
FROM users 
WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3' 
AND (role = 'user' OR role IS NULL)
GROUP BY category, gender 
ORDER BY category, gender;

-- 3. CREAR PARTIDOS CON RESULTADOS
-- =====================================================
-- Vamos a crear partidos que generen puntos para el sistema
-- Primero obtenemos los IDs de las jugadoras de categoría 5

DO $$
DECLARE
  lucia_id UUID;
  ana_id UUID;
  florencia_id UUID;
  camila_id UUID;
BEGIN
  -- Obtener IDs de jugadoras
  SELECT id INTO lucia_id FROM users WHERE email = 'lucia.h@test.com';
  SELECT id INTO ana_id FROM users WHERE email = 'ana.m@test.com';
  SELECT id INTO florencia_id FROM users WHERE email = 'florencia.s@test.com';
  SELECT id INTO camila_id FROM users WHERE email = 'camila.t@test.com';

  -- Insertar partidos solo si encontramos todos los IDs
  IF lucia_id IS NOT NULL AND ana_id IS NOT NULL AND florencia_id IS NOT NULL AND camila_id IS NOT NULL THEN
    
    -- Partido 1: Lucía Herrera + Ana Martínez vs Florencia Sosa + Camila Torres
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      lucia_id,
      '2024-04-01', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa'),
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 4),
        jsonb_build_object('games_a', 6, 'games_b', 2)
      ),
      ARRAY[lucia_id]
    );

    -- Partido 2: Lucía Herrera + Camila Torres vs Ana Martínez + Florencia Sosa  
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      lucia_id,
      '2024-04-02', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez'),
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 7, 'games_b', 6),
        jsonb_build_object('games_a', 6, 'games_b', 4)
      ),
      ARRAY[lucia_id]
    );

    -- Partido 3: Lucía Herrera + Ana Martínez vs Camila Torres + Florencia Sosa
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      lucia_id,
      '2024-04-03', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres'),
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 3),
        jsonb_build_object('games_a', 6, 'games_b', 1)
      ),
      ARRAY[lucia_id]
    );

    -- Partido 4: Lucía Herrera + Camila Torres vs Ana Martínez + Florencia Sosa
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      lucia_id,
      '2024-04-04', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez'),
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 2),
        jsonb_build_object('games_a', 6, 'games_b', 3)
      ),
      ARRAY[lucia_id]
    );

    -- Partido 5: Lucía Herrera + Florencia Sosa vs Ana Martínez + Camila Torres
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      lucia_id,
      '2024-04-05', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez'),
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 7, 'games_b', 5),
        jsonb_build_object('games_a', 6, 'games_b', 4)
      ),
      ARRAY[lucia_id]
    );

    -- Partido 6: Lucía Herrera + Ana Martínez vs Florencia Sosa + Camila Torres
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      lucia_id,
      '2024-04-06', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa'),
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 1),
        jsonb_build_object('games_a', 6, 'games_b', 0)
      ),
      ARRAY[lucia_id]
    );

    -- Partido 7: Ana Martínez + Florencia Sosa vs Lucía Herrera + Camila Torres
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      ana_id,
      '2024-04-07', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez'),
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 4),
        jsonb_build_object('games_a', 6, 'games_b', 3)
      ),
      ARRAY[ana_id]
    );

    -- Partido 8: Ana Martínez + Camila Torres vs Lucía Herrera + Florencia Sosa
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      ana_id,
      '2024-04-08', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez'),
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 2),
        jsonb_build_object('games_a', 7, 'games_b', 5)
      ),
      ARRAY[ana_id]
    );

    -- Partido 9: Camila Torres + Florencia Sosa vs Lucía Herrera + Ana Martínez
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      camila_id,
      '2024-04-09', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres'),
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 4),
        jsonb_build_object('games_a', 6, 'games_b', 3)
      ),
      ARRAY[camila_id]
    );

    -- Partido 10: Camila Torres + Ana Martínez vs Lucía Herrera + Florencia Sosa
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      camila_id,
      '2024-04-10', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', camila_id, 'name', 'Camila Torres'),
        jsonb_build_object('user_id', ana_id, 'name', 'Ana Martínez')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', lucia_id, 'name', 'Lucía Herrera'),
        jsonb_build_object('user_id', florencia_id, 'name', 'Florencia Sosa')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 4),
        jsonb_build_object('games_a', 6, 'games_b', 4)
      ),
      ARRAY[camila_id, lucia_id]
    );
    
  END IF;
END $$;

-- =====================================================
-- PARTIDOS HOMBRES CATEGORÍA 5
-- =====================================================
DO $$
DECLARE
  carlos_id UUID;
  juan_id UUID;
  andres_id UUID;
  facundo_id UUID;
BEGIN
  SELECT id INTO carlos_id FROM users WHERE email = 'carlos.l@test.com';
  SELECT id INTO juan_id FROM users WHERE email = 'juan.p@test.com';
  SELECT id INTO andres_id FROM users WHERE email = 'andres.s@test.com';
  SELECT id INTO facundo_id FROM users WHERE email = 'facundo.t@test.com';

  IF carlos_id IS NOT NULL AND juan_id IS NOT NULL AND andres_id IS NOT NULL AND facundo_id IS NOT NULL THEN
    
    -- Partido 1: Carlos López + Juan Pérez vs Andrés Silva + Facundo Torres
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      carlos_id,
      '2024-04-01', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', carlos_id, 'name', 'Carlos López'),
        jsonb_build_object('user_id', juan_id, 'name', 'Juan Pérez')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', andres_id, 'name', 'Andrés Silva'),
        jsonb_build_object('user_id', facundo_id, 'name', 'Facundo Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 3),
        jsonb_build_object('games_a', 6, 'games_b', 2)
      ),
      ARRAY[carlos_id]
    );

    -- Partido 2: Carlos López + Facundo Torres vs Juan Pérez + Andrés Silva
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      carlos_id,
      '2024-04-02', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', carlos_id, 'name', 'Carlos López'),
        jsonb_build_object('user_id', facundo_id, 'name', 'Facundo Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', juan_id, 'name', 'Juan Pérez'),
        jsonb_build_object('user_id', andres_id, 'name', 'Andrés Silva')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 4),
        jsonb_build_object('games_a', 7, 'games_b', 5)
      ),
      ARRAY[carlos_id]
    );

    -- Partido 3: Carlos López + Andrés Silva vs Juan Pérez + Facundo Torres
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      carlos_id,
      '2024-04-03', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', carlos_id, 'name', 'Carlos López'),
        jsonb_build_object('user_id', andres_id, 'name', 'Andrés Silva')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', juan_id, 'name', 'Juan Pérez'),
        jsonb_build_object('user_id', facundo_id, 'name', 'Facundo Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 1),
        jsonb_build_object('games_a', 6, 'games_b', 2)
      ),
      ARRAY[carlos_id]
    );

    -- Partido 4: Juan Pérez + Facundo Torres vs Carlos López + Andrés Silva
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      juan_id,
      '2024-04-04', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', juan_id, 'name', 'Juan Pérez'),
        jsonb_build_object('user_id', facundo_id, 'name', 'Facundo Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', carlos_id, 'name', 'Carlos López'),
        jsonb_build_object('user_id', andres_id, 'name', 'Andrés Silva')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 4),
        jsonb_build_object('games_a', 6, 'games_b', 3)
      ),
      ARRAY[juan_id]
    );

    -- Partido 5: Juan Pérez + Carlos López vs Andrés Silva + Facundo Torres
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      juan_id,
      '2024-04-05', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', juan_id, 'name', 'Juan Pérez'),
        jsonb_build_object('user_id', carlos_id, 'name', 'Carlos López')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', andres_id, 'name', 'Andrés Silva'),
        jsonb_build_object('user_id', facundo_id, 'name', 'Facundo Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 2),
        jsonb_build_object('games_a', 6, 'games_b', 1)
      ),
      ARRAY[juan_id]
    );

    -- Partido 6: Facundo Torres + Andrés Silva vs Carlos López + Juan Pérez
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      facundo_id,
      '2024-04-06', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', facundo_id, 'name', 'Facundo Torres'),
        jsonb_build_object('user_id', andres_id, 'name', 'Andrés Silva')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', carlos_id, 'name', 'Carlos López'),
        jsonb_build_object('user_id', juan_id, 'name', 'Juan Pérez')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 4),
        jsonb_build_object('games_a', 6, 'games_b', 4)
      ),
      ARRAY[facundo_id, carlos_id]
    );

    -- Partido 7: Facundo Torres + Carlos López vs Juan Pérez + Andrés Silva
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      facundo_id,
      '2024-04-07', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', facundo_id, 'name', 'Facundo Torres'),
        jsonb_build_object('user_id', carlos_id, 'name', 'Carlos López')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', juan_id, 'name', 'Juan Pérez'),
        jsonb_build_object('user_id', andres_id, 'name', 'Andrés Silva')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 3),
        jsonb_build_object('games_a', 6, 'games_b', 2)
      ),
      ARRAY[facundo_id]
    );

    -- Partido 8: Andrés Silva + Juan Pérez vs Carlos López + Facundo Torres
    INSERT INTO matches (id, club_id, created_by, date, status, team_a, team_b, sets, validated_by)
    VALUES (
      gen_random_uuid(), 
      '67a5b532-879c-4ae0-9b79-68f50d2f12e3', 
      andres_id,
      '2024-04-08', 
      'confirmed',
      jsonb_build_array(
        jsonb_build_object('user_id', andres_id, 'name', 'Andrés Silva'),
        jsonb_build_object('user_id', juan_id, 'name', 'Juan Pérez')
      ),
      jsonb_build_array(
        jsonb_build_object('user_id', carlos_id, 'name', 'Carlos López'),
        jsonb_build_object('user_id', facundo_id, 'name', 'Facundo Torres')
      ),
      jsonb_build_array(
        jsonb_build_object('games_a', 6, 'games_b', 4),
        jsonb_build_object('games_a', 7, 'games_b', 6)
      ),
      ARRAY[andres_id]
    );
    
  END IF;
END $$;

-- Verificar partidos creados
SELECT 'Partidos creados' as estado, COUNT(*) as total FROM matches WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3';
