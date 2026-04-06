-- Add tournament configuration columns
ALTER TABLE intercountry_tournaments 
ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS match_days TEXT[] DEFAULT ARRAY['saturday'];
