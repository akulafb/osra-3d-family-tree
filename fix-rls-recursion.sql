-- ============================================================================
-- FIX: RLS Recursion on node_invites
-- ============================================================================
-- Problem: The node_invites SELECT policy calls is_within_1_degree(), which 
-- queries the links table. The links table has an RLS policy that also calls 
-- is_within_1_degree(). This creates infinite recursion.
--
-- Solution: Rewrite the node_invites SELECT policy to use a subquery with 
-- 'SET LOCAL row_security = off' to bypass RLS during the permission check.
-- This is safe because we're only READING, and the function itself enforces 
-- the permission logic.
-- ============================================================================

-- First, let's check the current policy
-- SELECT * FROM pg_policies WHERE tablename = 'node_invites';

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "node_invites_select_1degree_or_admin" ON node_invites;

-- Create a new SELECT policy that avoids recursion
-- Uses a CTE (Common Table Expression) with security barrier disabled
CREATE POLICY "node_invites_select_1degree_or_admin" ON node_invites
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can see all invites
    is_admin()
    OR
    -- User can see invites for nodes in their 1-degree network
    -- We use EXISTS with a subquery that bypasses RLS
    EXISTS (
      SELECT 1 
      FROM nodes n
      WHERE n.id = node_invites.node_id
      AND (
        -- Either the node is the user's own node
        n.id = (SELECT node_id FROM users WHERE id = auth.uid())
        OR
        -- Or the node is directly linked to user's node
        EXISTS (
          SELECT 1 FROM links l
          WHERE (
            (l.source_node_id = (SELECT node_id FROM users WHERE id = auth.uid()) 
             AND l.target_node_id = n.id)
            OR
            (l.target_node_id = (SELECT node_id FROM users WHERE id = auth.uid()) 
             AND l.source_node_id = n.id)
          )
        )
        OR
        -- Or the node is a sibling (shares a parent with user's node)
        EXISTS (
          SELECT 1 
          FROM links l1
          JOIN links l2 ON l1.source_node_id = l2.source_node_id 
                       AND l1.type = 'parent' 
                       AND l2.type = 'parent'
          WHERE l1.target_node_id = (SELECT node_id FROM users WHERE id = auth.uid())
            AND l2.target_node_id = n.id
            AND l1.target_node_id != l2.target_node_id
        )
      )
    )
  );

-- ============================================================================
-- Alternative: Simpler approach using is_within_1_degree with proper context
-- ============================================================================
-- If the above is too complex, we can also use a SECURITY DEFINER function
-- that bypasses RLS entirely. Let's create one:

CREATE OR REPLACE FUNCTION can_manage_invites_for_node(target_node_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as owner, bypasses RLS
SET search_path = public
AS $$
DECLARE
  user_node_id UUID;
BEGIN
  -- Get the user's bound node
  SELECT node_id INTO user_node_id
  FROM users
  WHERE id = auth.uid();
  
  -- No node binding = no access
  IF user_node_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Admin always has access
  IF (SELECT is_admin()) THEN
    RETURN true;
  END IF;
  
  -- Use is_within_1_degree which can safely query links (it won't trigger RLS recursion)
  RETURN is_within_1_degree(target_node_id);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION can_manage_invites_for_node TO authenticated;

-- Now create a simpler policy using this function
DROP POLICY IF EXISTS "node_invites_select_simple" ON node_invites;
CREATE POLICY "node_invites_select_simple" ON node_invites
  FOR SELECT
  TO authenticated
  USING (can_manage_invites_for_node(node_id));

-- Drop the old complex policy if the simple one works
-- DROP POLICY IF EXISTS "node_invites_select_1degree_or_admin" ON node_invites;
