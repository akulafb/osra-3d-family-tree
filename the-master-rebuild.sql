-- ============================================================================
-- THE MASTER REBUILD: Security, Ambiguity, and Network Expansion
-- ============================================================================
-- This script handles everything in the correct order to avoid dependency 
-- errors and ensures a "production-ready" state.
-- ============================================================================

-- 1. DROP ALL POLICIES ON ALL TABLES TO CLEAR DEPENDENCIES
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  -- nodes
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'nodes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON nodes', pol.policyname);
  END LOOP;
  -- links
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'links' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON links', pol.policyname);
  END LOOP;
  -- node_invites
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'node_invites' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON node_invites', pol.policyname);
  END LOOP;
  -- users
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', pol.policyname);
  END LOOP;
END $$;

-- 2. DROP AND RECREATE FUNCTIONS (Now safe because policies are gone)
DROP FUNCTION IF EXISTS can_manage_invites_for_node(uuid);
DROP FUNCTION IF EXISTS is_within_1_degree(uuid);
DROP FUNCTION IF EXISTS is_admin();

-- 2a. Recreate is_admin (Unambiguous)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Changed to DEFINER to be safe in all contexts
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 2b. Recreate is_within_1_degree (Unambiguous + Sibling Logic)
CREATE OR REPLACE FUNCTION is_within_1_degree(p_target_node_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_node_id UUID;
BEGIN
  SELECT node_id INTO v_user_node_id
  FROM users
  WHERE id = auth.uid();
  
  IF v_user_node_id IS NULL THEN RETURN FALSE; END IF;
  IF p_target_node_id = v_user_node_id THEN RETURN TRUE; END IF;
  
  -- Direct connection check (Qualify columns explicitly)
  IF EXISTS (
    SELECT 1 FROM links l
    WHERE (l.source_node_id = v_user_node_id AND l.target_node_id = p_target_node_id)
       OR (l.target_node_id = v_user_node_id AND l.source_node_id = p_target_node_id)
  ) THEN RETURN TRUE; END IF;

  -- Sibling check (Shared Parent Logic)
  IF EXISTS (
    SELECT 1 
    FROM links l1
    JOIN links l2 ON l1.source_node_id = l2.source_node_id 
                 AND l1.type = 'parent' 
                 AND l2.type = 'parent'
    WHERE l1.target_node_id = v_user_node_id
      AND l2.target_node_id = p_target_node_id
      AND l1.target_node_id != l2.target_node_id
  ) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;

-- 2c. Recreate can_manage_invites_for_node (Unambiguous)
CREATE OR REPLACE FUNCTION can_manage_invites_for_node(p_node_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_node_id UUID;
BEGIN
  SELECT node_id INTO v_user_node_id
  FROM users
  WHERE id = auth.uid();
  
  IF v_user_node_id IS NULL THEN RETURN FALSE; END IF;
  IF (SELECT is_admin()) THEN RETURN TRUE; END IF;
  
  RETURN is_within_1_degree(p_node_id);
END;
$$;

-- 3. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_within_1_degree(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_invites_for_node(uuid) TO authenticated;

-- 4. RE-ESTABLISH POLICIES (Hardened & Optimized)

-- NODES
CREATE POLICY "nodes_select_authenticated" ON nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "nodes_update_1degree_or_admin" ON nodes FOR UPDATE TO authenticated 
  USING (is_admin() OR is_within_1_degree(id))
  WITH CHECK (is_admin() OR is_within_1_degree(id));
CREATE POLICY "nodes_insert_by_bound_users" ON nodes FOR INSERT TO authenticated 
  WITH CHECK (created_by_user_id = auth.uid() AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND node_id IS NOT NULL));
CREATE POLICY "nodes_delete_admin_only" ON nodes FOR DELETE TO authenticated USING (is_admin());

-- LINKS
CREATE POLICY "links_select_authenticated" ON links FOR SELECT TO authenticated USING (true);
CREATE POLICY "links_update_1degree_or_admin" ON links FOR UPDATE TO authenticated 
  USING (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id))
  WITH CHECK (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id));
CREATE POLICY "links_insert_1degree_or_admin" ON links FOR INSERT TO authenticated 
  WITH CHECK (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id));
CREATE POLICY "links_delete_admin_only" ON links FOR DELETE TO authenticated USING (is_admin());

-- NODE_INVITES
CREATE POLICY "node_invites_select_simple" ON node_invites FOR SELECT TO authenticated USING (can_manage_invites_for_node(node_id));
CREATE POLICY "node_invites_insert_1degree" ON node_invites FOR INSERT TO authenticated WITH CHECK (can_manage_invites_for_node(node_id));
CREATE POLICY "node_invites_delete_1degree" ON node_invites FOR DELETE TO authenticated USING (can_manage_invites_for_node(node_id));
CREATE POLICY "invites_select_public" ON node_invites FOR SELECT TO public USING (true);

-- USERS
CREATE POLICY "users_select_own_or_admin" ON users FOR SELECT TO authenticated USING (id = auth.uid() OR is_admin());
CREATE POLICY "users_update_admin_only" ON users FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "users_insert_blocked" ON users FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "users_delete_admin_only" ON users FOR DELETE TO authenticated USING (is_admin());
