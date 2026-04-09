-- Configuración correcta para sistema de puntos acumulativos (max 500)
-- Actualiza la configuración del club para usar base 0 y máximo 500

-- Agregar columna max_rating si no existe
ALTER TABLE club_point_configs 
ADD COLUMN IF NOT EXISTS max_rating INTEGER DEFAULT 500;

-- Primero, eliminar configuración anterior si existe
DELETE FROM club_point_configs 
WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3';

-- Insertar configuración correcta para sistema de puntos
INSERT INTO club_point_configs (
  club_id,
  base_rating,
  points_per_win,
  points_per_loss,
  points_per_game_diff,
  category_bonus_percent,
  category_penalty_percent,
  max_points_per_match,
  min_rating,
  max_rating,
  created_at,
  updated_at
) VALUES (
  '67a5b532-879c-4ae0-9b79-68f50d2f12e3',
  0,        -- base_rating: empiezan en 0 (no 1500)
  20,       -- points_per_win: 20 puntos base por victoria
  0,        -- points_per_loss: 0 (no se restan puntos, solo se ganan)
  0.5,      -- points_per_game_diff: 0.5 puntos por cada game de diferencia
  10,       -- category_bonus_percent: 10% bonus por ganar a superior
  0,        -- category_penalty_percent: 0% penalización (solo acumulan)
  50,       -- max_points_per_match: máximo 50 puntos por partido
  0,        -- min_rating: mínimo 0
  500,      -- max_rating: MÁXIMO 500 puntos para ascenso
  NOW(),
  NOW()
);

-- Resetear todos los ratings a 0 para que el recálculo funcione correctamente
UPDATE users 
SET 
  rating = 0,
  total_matches = 0,
  win_rate = 0
WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3'
AND (role = 'user' OR role IS NULL);

-- Verificar configuración
SELECT 'Configuración actualizada' as estado, 
       base_rating, 
       max_rating, 
       points_per_win,
       points_per_loss
FROM club_point_configs 
WHERE club_id = '67a5b532-879c-4ae0-9b79-68f50d2f12e3';
