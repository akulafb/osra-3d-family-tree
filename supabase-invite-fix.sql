-- ============================================================================
-- FIX: Allow public read access to invites for validation
-- ============================================================================
-- This allows unauthenticated users to check if an invite token is valid
-- BEFORE they log in. Without this, the invite page shows "Invalid Invite"
-- ============================================================================

-- Drop the existing restrictive SELECT policy if it exists
DROP POLICY IF EXISTS "Users can read invites for 1-degree relatives" ON node_invites;

-- Create a new SELECT policy that allows:
-- 1. Unauthenticated users to read invites (for validation before login)
-- 2. Authenticated users to read invites they created or for their 1-degree relatives
CREATE POLICY "Public can read invites for validation"
ON node_invites
FOR SELECT
TO public  -- This includes both authenticated and anon users
USING (true);  -- Allow reading any invite (we validate token on app side)

-- Note: The CREATE/UPDATE/DELETE policies remain restrictive,
-- only SELECT is opened up for public access

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'node_invites' AND cmd = 'SELECT';
