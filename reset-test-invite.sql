-- ============================================================================
-- RESET TEST ENVIRONMENT
-- ============================================================================
-- This script resets the test invite and user for testing the invite flow
-- Run this before testing the invite claim process

-- 1. Reset the test invite (unclaim it)
UPDATE node_invites
SET claimed_by_user_id = NULL
WHERE token = 'test-invite-fahd-2026';

-- 2. Delete the test user record (so we can re-claim)
DELETE FROM users
WHERE id = '952db081-34ec-41a1-bf97-332867926b63'::uuid;

-- 3. Verify the reset
SELECT 
  'Invite Status' as check_type,
  token,
  node_id::text,
  COALESCE(claimed_by_user_id::text, 'NULL') as claimed_by,
  expires_at::text
FROM node_invites
WHERE token = 'test-invite-fahd-2026'

UNION ALL

SELECT 
  'User Record' as check_type,
  id::text as token,
  node_id::text,
  role as claimed_by,
  created_at::text as expires_at
FROM users
WHERE id::text LIKE '952db081%';

-- Expected result:
-- - Invite should show claimed_by = 'NULL'
-- - User query should return 0 rows (user deleted)
