-- ============================================================================
-- FIX: node_invites INSERT and DELETE policies + is_within_1_degree logic
-- ============================================================================
-- Problem 1: Users could only SELECT invites, but not CREATE or DELETE them.
-- Problem 2: DB version of is_within_1_degree was too narrow (missed siblings).
-- ============================================================================

-- 1. Update is_within_1_degree to include siblings (share a parent)
CREATE OR REPLACE FUNCTION is_within_1_degree(target_node_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- 1. Direct connection (parent-child or marriage)
  IF EXISTS (
    SELECT 1 FROM links
    WHERE (source_node_id = user_node_id AND target_node_id = target_node_id)
       OR (target_node_id = user_node_id AND source_node_id = target_node_id)
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Sibling check (sharing a parent)
  IF EXISTS (
    SELECT 1 
    FROM links l1
    JOIN links l2 ON l1.source_node_id = l2.source_node_id 
                 AND l1.type = 'parent' 
                 AND l2.type = 'parent'
    WHERE l1.target_node_id = user_node_id
      AND l2.target_node_id = target_node_id
      AND l1.target_node_id != l2.target_node_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 2. Drop the restrictive admin-only policies
DROP POLICY IF EXISTS "invites_insert_admin_only" ON node_invites;
DROP POLICY IF EXISTS "invites_delete_admin_only" ON node_invites;

-- 3. Create INSERT policy using the helper
CREATE POLICY "node_invites_insert_1degree" ON node_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (can_manage_invites_for_node(node_id));

-- 4. Create DELETE policy
CREATE POLICY "node_invites_delete_1degree" ON node_invites
  FOR DELETE
  TO authenticated
  USING (can_manage_invites_for_node(node_id));

-- 5. Final check on SELECT policy
DROP POLICY IF EXISTS "node_invites_select_simple" ON node_invites;
CREATE POLICY "node_invites_select_simple" ON node_invites
  FOR SELECT
  TO authenticated
  USING (can_manage_invites_for_node(node_id));
