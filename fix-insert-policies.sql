-- ============================================================================
-- FIX OVERLY PERMISSIVE INSERT POLICIES
-- ============================================================================
-- Issue: nodes_insert_authenticated and links_insert_authenticated allow
-- unrestricted inserts (WITH CHECK true)
-- 
-- Solution: Enforce proper 1-degree network constraints
-- ============================================================================

-- Drop the overly permissive INSERT policies
DROP POLICY IF EXISTS "nodes_insert_authenticated" ON nodes;
DROP POLICY IF EXISTS "links_insert_authenticated" ON links;

-- ============================================================================
-- NODES INSERT: Users can only create nodes they will connect to
-- ============================================================================
-- Logic: New node must be created by the user, and the user must have a node_id
-- The app logic will ensure the new node gets linked to the user's network

CREATE POLICY "nodes_insert_by_bound_users" ON nodes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be creating it themselves
    created_by_user_id = auth.uid()
    AND
    -- User must have a node binding (can't create nodes if not in the tree)
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND node_id IS NOT NULL
    )
    -- Note: App logic must ensure the new node gets linked to user's network
    -- We can't check the link here because it doesn't exist yet at INSERT time
  );

-- Alternative stricter policy (commented out): Only admins can insert nodes
-- Uncomment this if you want to prevent regular users from adding nodes entirely
-- CREATE POLICY "nodes_insert_admin_only" ON nodes
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (is_admin());

-- ============================================================================
-- LINKS INSERT: Users can create links within their 1-degree network
-- ============================================================================
-- Logic: At least one endpoint must be in the user's 1-degree network

CREATE POLICY "links_insert_1degree_or_admin" ON links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() 
    OR 
    is_within_1_degree(source_node_id) 
    OR 
    is_within_1_degree(target_node_id)
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check the new policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('nodes', 'links')
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;

-- Expected result:
-- nodes: nodes_insert_by_bound_users with proper WITH CHECK
-- links: links_insert_1degree_or_admin with proper WITH CHECK
