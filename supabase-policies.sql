-- ============================================================================
-- Step 4C: Full 1-Degree Permission RLS Policies
-- ============================================================================
-- These policies enforce the rule: users can only create/update/delete
-- nodes and links within their 1-degree network (self, parents, children,
-- siblings, spouse)
--
-- PREREQUISITE: Step 4B policies should already be in place for:
--   - Read access to nodes/links for authenticated users
--   - Invite claim and user-node binding
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a node is within 1-degree of the current user's node
CREATE OR REPLACE FUNCTION is_within_1_degree(target_node_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_node_id UUID;
BEGIN
  -- Get the current user's bound node
  SELECT node_id INTO user_node_id
  FROM users
  WHERE id = auth.uid();
  
  -- If user has no bound node, deny access
  IF user_node_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if target is self
  IF target_node_id = user_node_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if target is parent, child, sibling, or spouse via links table
  RETURN EXISTS (
    SELECT 1 FROM links
    WHERE (
      -- Parent: user is child, target is parent
      (source_node_id = target_node_id AND target_node_id = user_node_id AND type = 'parent')
      OR
      -- Child: user is parent, target is child
      (source_node_id = user_node_id AND target_node_id = target_node_id AND type = 'parent')
      OR
      -- Spouse: marriage link between user and target
      (type = 'marriage' AND (
        (source_node_id = user_node_id AND target_node_id = target_node_id)
        OR
        (source_node_id = target_node_id AND target_node_id = user_node_id)
      ))
      OR
      -- Sibling: both share at least one parent
      EXISTS (
        SELECT 1 FROM links l1
        JOIN links l2 ON l1.source_node_id = l2.source_node_id
        WHERE l1.type = 'parent' 
          AND l2.type = 'parent'
          AND l1.target_node_id = user_node_id
          AND l2.target_node_id = target_node_id
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- NODES TABLE POLICIES
-- ============================================================================

-- CREATE: Users can create nodes only within their 1-degree network
-- (In practice, this is enforced via app logic more than RLS, but we add
-- a safety policy that checks the created_by_user_id)
CREATE POLICY "Users can create nodes they will be related to"
ON nodes
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin() 
  OR 
  created_by_user_id = auth.uid()
);

-- UPDATE: Users can update only their 1-degree relatives
CREATE POLICY "Users can update their 1-degree relatives"
ON nodes
FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR
  is_within_1_degree(id)
);

-- DELETE: Only admins can delete nodes
CREATE POLICY "Only admins can delete nodes"
ON nodes
FOR DELETE
TO authenticated
USING (is_admin());

-- ============================================================================
-- LINKS TABLE POLICIES
-- ============================================================================

-- CREATE: Users can create links involving their 1-degree relatives
CREATE POLICY "Users can create links within 1-degree network"
ON links
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin()
  OR
  (
    created_by_user_id = auth.uid()
    AND
    (
      is_within_1_degree(source_node_id)
      OR
      is_within_1_degree(target_node_id)
    )
  )
);

-- UPDATE: Users can update links within their 1-degree network
CREATE POLICY "Users can update links within 1-degree network"
ON links
FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR
  (
    is_within_1_degree(source_node_id)
    OR
    is_within_1_degree(target_node_id)
  )
);

-- DELETE: Only admins can delete links (prevents breaking the graph)
CREATE POLICY "Only admins can delete links"
ON links
FOR DELETE
TO authenticated
USING (is_admin());

-- ============================================================================
-- NODE_INVITES TABLE POLICIES (if not already covered in 4B)
-- ============================================================================

-- CREATE: Users can create invites for their 1-degree relatives
CREATE POLICY "Users can create invites for 1-degree relatives"
ON node_invites
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin()
  OR
  (
    created_by_user_id = auth.uid()
    AND
    is_within_1_degree(node_id)
  )
);

-- UPDATE: Users can update invites they created or for their 1-degree relatives
CREATE POLICY "Users can update invites for 1-degree relatives"
ON node_invites
FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR
  created_by_user_id = auth.uid()
  OR
  is_within_1_degree(node_id)
);

-- DELETE: Users can delete invites they created
CREATE POLICY "Users can delete invites they created"
ON node_invites
FOR DELETE
TO authenticated
USING (
  is_admin()
  OR
  created_by_user_id = auth.uid()
);

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. The is_within_1_degree function checks sibling relationships by finding
--    shared parents. This may need optimization for large graphs.
--
-- 2. Admin role has full access to all operations.
--
-- 3. Node creation is somewhat permissive (checking only created_by_user_id)
--    because the app will enforce stricter validation. The RLS here is a
--    safety net.
--
-- 4. Link deletion is admin-only to prevent users from accidentally breaking
--    the graph structure.
--
-- 5. You may want to add audit logging for sensitive operations (deletes,
--    role changes, etc.)
-- ============================================================================
