-- Add gender field to users table for ranking filters
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gender VARCHAR(1) DEFAULT NULL;

-- Add check constraint for gender values
ALTER TABLE users 
ADD CONSTRAINT users_gender_check 
CHECK (gender IS NULL OR gender IN ('M', 'F'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_category_gender ON users(category, gender);

-- Update some existing users with sample gender data (optional)
-- UPDATE users SET gender = 'M' WHERE name LIKE '%Juan%' OR name LIKE '%Carlos%' OR name LIKE '%Pedro%';
-- UPDATE users SET gender = 'F' WHERE name LIKE '%María%' OR name LIKE '%Ana%' OR name LIKE '%Laura%';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'gender';
