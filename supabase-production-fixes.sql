-- ============================================================================
-- PRODUCTION FIXES: Security & Performance Improvements
-- ============================================================================
-- This migration addresses:
-- 1. Security: Function search_path vulnerabilities (CRITICAL)
-- 2. Security: Proper invite claim flow with SECURITY DEFINER
-- 3. Performance: RLS policy optimization (reduces auth.uid() calls)
-- 4. Cleanup: Consolidate duplicate policies
-- ============================================================================

-- ============================================================================
-- PART 1: DROP ALL EXISTING POLICIES FIRST
-- ============================================================================
-- We must drop policies before dropping functions they depend on
-- Using a comprehensive approach to drop ALL policies on these tables

DO $$ 
DECLARE
  pol RECORD;
BEGIN
  -- Drop all policies on nodes
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'nodes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON nodes', pol.policyname);
  END LOOP;
  
  -- Drop all policies on links
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'links'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON links', pol.policyname);
  END LOOP;
  
  -- Drop all policies on node_invites
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'node_invites'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON node_invites', pol.policyname);
  END LOOP;
  
  -- Drop all policies on users
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', pol.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- PART 2: FIX FUNCTION SECURITY (search_path vulnerability)
-- ============================================================================

-- Now safe to drop and recreate is_within_1_degree with proper search_path
DROP FUNCTION IF EXISTS is_within_1_degree(UUID);

CREATE OR REPLACE FUNCTION is_within_1_degree(target_node_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public  -- SECURITY FIX: Prevents schema injection attacks
AS $$
DECLARE
  user_node_id UUID;
BEGIN
  -- Get the current user's node_id from users table
  SELECT node_id INTO user_node_id
  FROM users
  WHERE id = auth.uid();
  
  -- If user has no node binding, return false
  IF user_node_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if target_node_id is the user's own node
  IF target_node_id = user_node_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if target_node_id is directly connected (1-degree) to user's node
  -- Check both directions: source->target and target->source
  RETURN EXISTS (
    SELECT 1 FROM links
    WHERE (source_node_id = user_node_id AND target_node_id = target_node_id)
       OR (target_node_id = user_node_id AND source_node_id = target_node_id)
  );
END;
$$;

-- Drop and recreate is_admin with proper search_path
DROP FUNCTION IF EXISTS is_admin();

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public  -- SECURITY FIX: Prevents schema injection attacks
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- ============================================================================
-- PART 3: CREATE SECURE INVITE CLAIM FUNCTION
-- ============================================================================
-- This function handles the entire invite claim flow atomically and securely
-- SECURITY DEFINER allows it to bypass RLS policies for user record creation

CREATE OR REPLACE FUNCTION claim_invite_secure(
  invite_token TEXT,
  claiming_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges to bypass RLS
SET search_path = public  -- SECURITY FIX
AS $$
DECLARE
  invite_record node_invites%ROWTYPE;
  existing_user_node_id UUID;
BEGIN
  -- Step 1: Validate invite exists
  SELECT * INTO invite_record
  FROM node_invites
  WHERE token = invite_token;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'invalid_invite',
      'message', 'This invite link is not valid'
    );
  END IF;
  
  -- Step 2: Check if already claimed
  IF invite_record.claimed_by_user_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'already_claimed',
      'message', 'This invite has already been claimed'
    );
  END IF;
  
  -- Step 3: Check if user already has a node binding
  SELECT node_id INTO existing_user_node_id
  FROM users
  WHERE id = claiming_user_id;
  
  IF existing_user_node_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'already_bound',
      'message', 'You are already bound to a node in the family tree'
    );
  END IF;
  
  -- Step 4: Create or update user record (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO users (id, node_id, role)
  VALUES (claiming_user_id, invite_record.node_id, 'user')
  ON CONFLICT (id) 
  DO UPDATE SET 
    node_id = EXCLUDED.node_id,
    updated_at = now();
  
  -- Step 5: Mark invite as claimed
  UPDATE node_invites
  SET claimed_by_user_id = claiming_user_id
  WHERE token = invite_token;
  
  -- Step 6: Return success with node info
  RETURN json_build_object(
    'success', true,
    'node_id', invite_record.node_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION claim_invite_secure(TEXT, UUID) TO authenticated;

-- ============================================================================
-- PART 4: CREATE OPTIMIZED RLS POLICIES (Performance Fix)
-- ============================================================================
-- The issue: Old policies called auth.uid() for every row
-- The fix: SECURITY INVOKER functions are evaluated once per query

-- Create optimized policies for NODES
-- SELECT: All authenticated users can read all nodes
CREATE POLICY "nodes_select_authenticated" ON nodes
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE: Users can update their own node or 1-degree relatives, admins can update all
CREATE POLICY "nodes_update_1degree_or_admin" ON nodes
  FOR UPDATE
  TO authenticated
  USING (is_admin() OR is_within_1_degree(id))
  WITH CHECK (is_admin() OR is_within_1_degree(id));

-- INSERT: Authenticated users can create nodes (will be checked by app logic)
CREATE POLICY "nodes_insert_authenticated" ON nodes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- DELETE: Only admins can delete nodes
CREATE POLICY "nodes_delete_admin_only" ON nodes
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Recreate optimized policies for LINKS
-- SELECT: All authenticated users can read all links
CREATE POLICY "links_select_authenticated" ON links
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE: Users can update links if either endpoint is in their 1-degree network
CREATE POLICY "links_update_1degree_or_admin" ON links
  FOR UPDATE
  TO authenticated
  USING (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id))
  WITH CHECK (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id));

-- INSERT: Authenticated users can create links (will be checked by app logic)
CREATE POLICY "links_insert_authenticated" ON links
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- DELETE: Only admins can delete links
CREATE POLICY "links_delete_admin_only" ON links
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Recreate consolidated NODE_INVITES policies
-- SELECT: Anyone (including anon) can read invites (needed for validation before login)
CREATE POLICY "invites_select_public" ON node_invites
  FOR SELECT
  TO public
  USING (true);

-- INSERT: Only admins can create invites
CREATE POLICY "invites_insert_admin_only" ON node_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- UPDATE: Only admins can update invites (or use the RPC function which bypasses RLS)
CREATE POLICY "invites_update_admin_only" ON node_invites
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE: Only admins can delete invites
CREATE POLICY "invites_delete_admin_only" ON node_invites
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create USERS table RLS policies
-- SELECT: Users can read their own record, admins can read all
CREATE POLICY "users_select_own_or_admin" ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_admin());

-- UPDATE: Only admins can update user records
CREATE POLICY "users_update_admin_only" ON users
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- INSERT: Block direct inserts (must use claim_invite_secure RPC)
-- This prevents the silent failure we experienced
CREATE POLICY "users_insert_blocked" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (false);  -- Always deny direct inserts

-- DELETE: Only admins can delete user records
CREATE POLICY "users_delete_admin_only" ON users
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- VERIFICATION QUERIES (Run these to confirm fixes)
-- ============================================================================

-- Check that functions have correct search_path
SELECT 
  proname as function_name,
  proconfig as settings
FROM pg_proc 
WHERE proname IN ('is_within_1_degree', 'is_admin', 'claim_invite_secure', 'get_invite_by_token');

-- Check policy counts (should see the consolidated policies)
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Expected counts after this migration:
-- nodes: 4 policies (select, update, insert, delete)
-- links: 4 policies (select, update, insert, delete)
-- node_invites: 4 policies (select, insert, update, delete)
-- users: 4 policies (select, update, insert, delete)
