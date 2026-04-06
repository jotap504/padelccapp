-- Check admin users
SELECT 
    id,
    email,
    name,
    role,
    status,
    club_id,
    created_at
FROM users 
WHERE role IN ('admin', 'superadmin')
ORDER BY role, created_at;
