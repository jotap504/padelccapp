-- Verificar y corregir club_id de TEST001
-- A veces el club_id queda NULL

-- Ver cuántos TEST001 hay
SELECT id, name, member_number, club_id, email
FROM users 
WHERE member_number = 'TEST001';

-- Si club_id es NULL, actualizarlo
UPDATE users 
SET club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3',
    updated_at = NOW()
WHERE member_number = 'TEST001' 
AND club_id IS NULL;

-- Verificar después
SELECT id, name, member_number, club_id
FROM users 
WHERE member_number = 'TEST001';
