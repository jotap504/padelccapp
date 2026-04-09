-- Resetear todos los ratings a 0 (sistema de puntos acumulativos, no ELO)
UPDATE users 
SET 
  rating = 0,
  total_matches = 0,
  win_rate = 0
WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3'
AND (role = 'user' OR role IS NULL);

-- Verificar el cambio
SELECT name, category, rating as puntos, total_matches, win_rate 
FROM users 
WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3'
AND (role = 'user' OR role IS NULL)
ORDER BY category, name;
