-- =============================================================================
-- Migration: Fix RPC functions and RLS policies for TEXT-based user IDs
-- =============================================================================

-- 1. Helper Function: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())::TEXT AND role = 'admin'
  );
END;
$$;

-- 2. Helper Function: is_within_1_degree(p_target_node_id uuid)
-- Includes Case 6 from 20260312_fix_spouse_child_permissions.sql
CREATE OR REPLACE FUNCTION public.is_within_1_degree(p_target_node_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_node_id uuid;
BEGIN
    -- Get the node_id bound to the current user
    SELECT node_id INTO user_node_id FROM public.users WHERE id = (select auth.uid())::TEXT;
    
    -- If user is not bound to a node, they have no 1-degree network
    IF user_node_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Case 1: The node is the user's own node
    IF p_target_node_id = user_node_id THEN
        RETURN TRUE;
    END IF;

    -- Case 2: Direct link (Parent, Child, or Spouse)
    IF EXISTS (
        SELECT 1 FROM public.links 
        WHERE (source_node_id = user_node_id AND target_node_id = p_target_node_id)
           OR (source_node_id = p_target_node_id AND target_node_id = user_node_id)
    ) THEN
        RETURN TRUE;
    END IF;

    -- Case 3: Siblings (Nodes that share at least one parent)
    IF EXISTS (
        SELECT 1 
        FROM public.links l1
        JOIN public.links l2 ON l1.source_node_id = l2.source_node_id
        WHERE l1.target_node_id = user_node_id 
          AND l2.target_node_id = p_target_node_id
          AND l1.type = 'parent' 
          AND l2.type = 'parent'
    ) THEN
        RETURN TRUE;
    END IF;

    -- Case 4: Parent's Spouse (e.g., Mother if linked to Father, or Step-parent)
    IF EXISTS (
        SELECT 1 
        FROM public.links l_parent
        JOIN public.links l_marriage ON (l_marriage.source_node_id = l_parent.source_node_id OR l_marriage.target_node_id = l_parent.source_node_id)
        WHERE l_parent.target_node_id = user_node_id
          AND l_parent.type = 'parent'
          AND l_marriage.type = 'marriage'
          AND (l_marriage.source_node_id = p_target_node_id OR l_marriage.target_node_id = p_target_node_id)
    ) THEN
        RETURN TRUE;
    END IF;

    -- Case 5: Child's other Parent
    IF EXISTS (
        SELECT 1
        FROM public.links l_child
        JOIN public.links l_other_parent ON l_other_parent.target_node_id = l_child.target_node_id
        WHERE l_child.source_node_id = user_node_id
          AND l_child.type = 'parent'
          AND l_other_parent.type = 'parent'
          AND l_other_parent.source_node_id = p_target_node_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Case 6: Child of a Spouse (New from 20260312 migration)
    IF EXISTS (
        SELECT 1 
        FROM public.links l_marriage
        JOIN public.links l_spouse_child ON (l_spouse_child.source_node_id = l_marriage.source_node_id OR l_spouse_child.source_node_id = l_marriage.target_node_id)
        WHERE (l_marriage.source_node_id = user_node_id OR l_marriage.target_node_id = user_node_id)
          AND (l_marriage.type = 'marriage' OR l_marriage.type = 'divorce')
          AND l_spouse_child.type = 'parent'
          AND l_spouse_child.target_node_id = p_target_node_id
          AND l_spouse_child.source_node_id != user_node_id
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 3. Helper Function: can_manage_invites_for_node(p_node_id uuid)
CREATE OR REPLACE FUNCTION public.can_manage_invites_for_node(p_node_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_node_id UUID;
BEGIN
  SELECT node_id INTO v_user_node_id FROM public.users WHERE id = (select auth.uid())::TEXT;
  IF v_user_node_id IS NULL THEN RETURN FALSE; END IF;
  IF (SELECT is_admin()) THEN RETURN TRUE; END IF;
  RETURN is_within_1_degree(p_node_id);
END;
$$;

-- 4. RPC Function: claim_invite_secure(invite_token text, claiming_user_id text)
-- Drop the old version first
DROP FUNCTION IF EXISTS public.claim_invite_secure(text, uuid);
CREATE OR REPLACE FUNCTION public.claim_invite_secure(invite_token text, claiming_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record public.node_invites%ROWTYPE;
  existing_user_node_id UUID;
BEGIN
  SELECT * INTO invite_record FROM public.node_invites WHERE token = invite_token;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'invalid_invite', 'message', 'This invite link is not valid');
  END IF;

  IF invite_record.claimed_by_user_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'already_claimed', 'message', 'This invite has already been claimed');
  END IF;

  SELECT node_id INTO existing_user_node_id FROM public.users WHERE id = claiming_user_id;
  IF existing_user_node_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'already_bound', 'message', 'You are already bound to a node in the family tree');
  END IF;

  INSERT INTO public.users (id, node_id, role)
  VALUES (claiming_user_id, invite_record.node_id, 'user')
  ON CONFLICT (id) DO UPDATE SET node_id = EXCLUDED.node_id;

  UPDATE public.node_invites SET claimed_by_user_id = claiming_user_id WHERE token = invite_token;

  RETURN json_build_object('success', true, 'node_id', invite_record.node_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_invite_secure(text, text) TO authenticated;

-- 5. RPC Function: create_relative_secure(new_node_name text, rel_type text, target_node_id uuid, creator_id text, p_parent_role text)
-- Includes logic for maternal clusters and parent roles from 20260304_fix_create_relative_ambiguous_column.sql
DROP FUNCTION IF EXISTS public.create_relative_secure(text, text, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_relative_secure(text, text, uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.create_relative_secure(
  new_node_name text,
  rel_type text,
  target_node_id uuid,
  creator_id text,
  p_parent_role text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  parent_id UUID;
  parent_count INTEGER := 0;
  target_cluster TEXT;
  spouse_cluster TEXT;
  spouse_id UUID;
  paternal_cluster TEXT;
  maternal_cluster TEXT;
  v_target uuid := target_node_id;
BEGIN
  SELECT paternal_family_cluster INTO target_cluster FROM public.nodes WHERE id = v_target;

  IF rel_type = 'child' AND p_parent_role IS NOT NULL THEN
    SELECT CASE
      WHEN l.source_node_id = v_target THEN l.target_node_id
      ELSE l.source_node_id
    END INTO spouse_id
    FROM public.links l
    WHERE l.type = 'marriage'
      AND (l.source_node_id = v_target OR l.target_node_id = v_target)
    LIMIT 1;

    IF p_parent_role = 'mother' THEN
      maternal_cluster := target_cluster;
      IF spouse_id IS NOT NULL THEN
        SELECT paternal_family_cluster INTO spouse_cluster FROM public.nodes WHERE id = spouse_id;
        paternal_cluster := spouse_cluster;
      ELSE
        paternal_cluster := target_cluster;
      END IF;
    ELSIF p_parent_role = 'father' THEN
      paternal_cluster := target_cluster;
      IF spouse_id IS NOT NULL THEN
        SELECT paternal_family_cluster INTO spouse_cluster FROM public.nodes WHERE id = spouse_id;
        maternal_cluster := spouse_cluster;
      ELSE
        maternal_cluster := NULL;
      END IF;
    ELSE
      paternal_cluster := target_cluster;
      maternal_cluster := NULL;
    END IF;
  ELSE
    paternal_cluster := target_cluster;
    maternal_cluster := NULL;
  END IF;

  INSERT INTO public.nodes (name, paternal_family_cluster, maternal_family_cluster, created_by_user_id)
  VALUES (new_node_name, paternal_cluster, maternal_cluster, creator_id)
  RETURNING id INTO new_id;

  IF rel_type = 'parent' THEN
    INSERT INTO public.links (source_node_id, target_node_id, type, parent_role, created_by_user_id)
    VALUES (new_id, v_target, 'parent', NULL, creator_id);

  ELSIF rel_type = 'child' THEN
    INSERT INTO public.links (source_node_id, target_node_id, type, parent_role, created_by_user_id)
    VALUES (v_target, new_id, 'parent', p_parent_role, creator_id);

  ELSIF rel_type = 'spouse' THEN
    INSERT INTO public.links (source_node_id, target_node_id, type, created_by_user_id)
    VALUES (v_target, new_id, 'marriage', creator_id);

  ELSIF rel_type = 'sibling' THEN
    FOR parent_id IN
      SELECT l.source_node_id FROM public.links l
      WHERE l.target_node_id = v_target AND l.type = 'parent'
    LOOP
      INSERT INTO public.links (source_node_id, target_node_id, type, parent_role, created_by_user_id)
      VALUES (parent_id, new_id, 'parent', NULL, creator_id);
      parent_count := parent_count + 1;
    END LOOP;

    IF parent_count = 0 THEN
      RAISE EXCEPTION 'Cannot add sibling: Target node has no parents to branch from.';
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid relationship type: %', rel_type;
  END IF;

  RETURN json_build_object('success', true, 'new_node_id', new_id, 'message', 'Relative added successfully');

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_relative_secure(text, text, uuid, text, text) TO authenticated;

-- 6. Update RLS Policies to handle TEXT-based IDs

-- Users table
DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT TO authenticated
  USING ((id = (select auth.uid())::TEXT) OR is_admin());

-- Nodes table
DROP POLICY IF EXISTS nodes_insert_by_bound_users ON public.nodes;
CREATE POLICY nodes_insert_by_bound_users ON public.nodes
  FOR INSERT TO authenticated
  WITH CHECK (
    (created_by_user_id = (select auth.uid())::TEXT)
    AND (EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())::TEXT AND node_id IS NOT NULL
    ))
  );

-- Node invites table
-- No direct auth.uid() in node_invites policies, they use can_manage_invites_for_node(node_id) which we already updated.
