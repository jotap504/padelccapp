-- Configuración de puntos por club
CREATE TABLE IF NOT EXISTS club_point_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  
  -- Configuración base
  base_rating INTEGER DEFAULT 1500,
  points_per_win INTEGER DEFAULT 20,
  points_per_loss INTEGER DEFAULT 20,
  points_per_game_diff DECIMAL(4,2) DEFAULT 0.5,
  
  -- Bonus por categoría (por cada categoría superior)
  -- Ej: Si un 6to le gana a un 4to = 2 categorías de diferencia = 40% extra
  category_bonus_percent DECIMAL(5,2) DEFAULT 20.00,
  
  -- Penalización por perder con menor categoría
  -- Ej: Si un 4to pierde con un 6to = 2 categorías de diferencia = -10% (5% por cada uno)
  category_penalty_percent DECIMAL(5,2) DEFAULT 5.00,
  
  -- Límites
  max_points_per_match INTEGER DEFAULT 50,
  min_rating INTEGER DEFAULT 1000,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(club_id)
);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_club_point_configs_updated_at ON club_point_configs;
CREATE TRIGGER update_club_point_configs_updated_at
  BEFORE UPDATE ON club_point_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insertar configuración por defecto para el club existente
INSERT INTO club_point_configs (club_id)
SELECT id FROM clubs LIMIT 1
ON CONFLICT (club_id) DO NOTHING;
