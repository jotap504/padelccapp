-- Check all users with their login info
SELECT 
    id,
    email,
    name,
    member_number,
    role,
    status,
    club_id,
    created_at
FROM users 
WHERE role IN ('admin', 'superadmin') OR member_number LIKE '%ADMIN%'
ORDER BY role, created_at;
