-- Crear usuario de prueba con contraseña
-- Club: demo-club (67a5b532-879c-4ae0-9b79-68f50d2f12e3)
-- Usuario: TEST001
-- Contraseña: 100

-- Generar hash de contraseña "100" usando bcrypt (cost 10)
-- El hash es: $2b$10$xqsfh9R2IChp.UcVyjxrmOx1tNxopp1G6z4JFR8xbQ0G08pAWyMum

-- Primero eliminar TODOS los usuarios anteriores con TEST001 (para evitar duplicados)
DELETE FROM users 
WHERE member_number = 'TEST001' 
AND club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3';

-- Insertar usuario nuevo con UUID fijo (para que no se duplique)
INSERT INTO users (id, name, email, member_number, password_hash, role, club_id, category, rating, gender, total_matches, win_rate, created_at) 
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Usuario Test',
  'test@padelclub.com',
  'TEST001',
  '$2b$10$xqsfh9R2IChp.UcVyjxrmOx1tNxopp1G6z4JFR8xbQ0G08pAWyMum',
  'user',
  '67a5b532-879c-4ae0-9b79-68f50d2f12e3',
  5,
  0,
  'M',
  0,
  0,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  password_hash = '$2b$10$xqsfh9R2IChp.UcVyjxrmOx1tNxopp1G6z4JFR8xbQ0G08pAWyMum',
  name = 'Usuario Test',
  email = 'test@padelclub.com',
  member_number = 'TEST001',
  club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3',
  updated_at = NOW();

-- Verificar usuario creado
SELECT name, member_number, category, club_id, password_hash 
FROM users 
WHERE member_number = 'TEST001';
