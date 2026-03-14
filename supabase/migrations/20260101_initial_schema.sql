-- =============================================================================
-- Osra 3D Family Tree - Initial Schema
-- Single migration for fresh Supabase projects. Run via: npx supabase db push
-- Or paste into Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id uuid,
  role text NOT NULL DEFAULT 'user',
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  paternal_family_cluster text,
  maternal_family_cluster text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('parent', 'marriage', 'divorce')),
  parent_role text CHECK (parent_role IS NULL OR parent_role IN ('mother', 'father')),
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.node_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  claimed_by_user_id uuid,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  target_node_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS links_source_node_id_idx ON public.links(source_node_id);
CREATE INDEX IF NOT EXISTS links_target_node_id_idx ON public.links(target_node_id);
CREATE INDEX IF NOT EXISTS node_invites_node_id_idx ON public.node_invites(node_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- FUNCTIONS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_within_1_degree(p_target_node_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_node_id uuid;
BEGIN
    SELECT node_id INTO user_node_id FROM public.users WHERE id = auth.uid();
    IF user_node_id IS NULL THEN RETURN FALSE; END IF;
    IF p_target_node_id = user_node_id THEN RETURN TRUE; END IF;

    IF EXISTS (
        SELECT 1 FROM public.links
        WHERE (source_node_id = user_node_id AND target_node_id = p_target_node_id)
           OR (source_node_id = p_target_node_id AND target_node_id = user_node_id)
    ) THEN RETURN TRUE; END IF;

    IF EXISTS (
        SELECT 1 FROM public.links l1
        JOIN public.links l2 ON l1.source_node_id = l2.source_node_id
        WHERE l1.target_node_id = user_node_id AND l2.target_node_id = p_target_node_id
          AND l1.type = 'parent' AND l2.type = 'parent'
    ) THEN RETURN TRUE; END IF;

    IF EXISTS (
        SELECT 1 FROM public.links l_parent
        JOIN public.links l_marriage ON (l_marriage.source_node_id = l_parent.source_node_id OR l_marriage.target_node_id = l_parent.source_node_id)
        WHERE l_parent.target_node_id = user_node_id AND l_parent.type = 'parent'
          AND l_marriage.type = 'marriage'
          AND (l_marriage.source_node_id = p_target_node_id OR l_marriage.target_node_id = p_target_node_id)
    ) THEN RETURN TRUE; END IF;

    IF EXISTS (
        SELECT 1 FROM public.links l_child
        JOIN public.links l_other_parent ON l_other_parent.target_node_id = l_child.target_node_id
        WHERE l_child.source_node_id = user_node_id AND l_child.type = 'parent'
          AND l_other_parent.type = 'parent' AND l_other_parent.source_node_id = p_target_node_id
    ) THEN RETURN TRUE; END IF;

    IF EXISTS (
        SELECT 1 FROM public.links l_marriage
        JOIN public.links l_spouse_child ON (l_spouse_child.source_node_id = l_marriage.source_node_id OR l_spouse_child.source_node_id = l_marriage.target_node_id)
        WHERE (l_marriage.source_node_id = user_node_id OR l_marriage.target_node_id = user_node_id)
          AND (l_marriage.type = 'marriage' OR l_marriage.type = 'divorce')
          AND l_spouse_child.type = 'parent' AND l_spouse_child.target_node_id = p_target_node_id
          AND l_spouse_child.source_node_id != user_node_id
    ) THEN RETURN TRUE; END IF;

    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_invites_for_node(p_node_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_node_id UUID;
BEGIN
  SELECT node_id INTO v_user_node_id FROM public.users WHERE id = auth.uid();
  IF v_user_node_id IS NULL THEN RETURN FALSE; END IF;
  IF (SELECT is_admin()) THEN RETURN TRUE; END IF;
  RETURN is_within_1_degree(p_node_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(invite_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', ni.id, 'node_id', ni.node_id, 'token', ni.token,
    'expires_at', ni.expires_at, 'claimed_by_user_id', ni.claimed_by_user_id,
    'created_by_user_id', ni.created_by_user_id, 'created_at', ni.created_at,
    'node_name', n.name
  ) INTO result
  FROM public.node_invites ni
  JOIN public.nodes n ON n.id = ni.node_id
  WHERE ni.token = invite_token;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_invite_secure(invite_token text, claiming_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record public.node_invites%ROWTYPE;
  existing_user_node_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized', 'message', 'You must be signed in');
  END IF;

  IF auth.uid() != claiming_user_id THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized', 'message', 'You can only claim an invite for yourself');
  END IF;

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

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = claiming_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'auth_not_found', 'message', 'Unable to retrieve profile');
  END IF;

  INSERT INTO public.users (id, node_id, role, full_name)
  SELECT
    claiming_user_id,
    invite_record.node_id,
    'user',
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name')
  FROM auth.users au
  WHERE au.id = claiming_user_id
  ON CONFLICT (id) DO UPDATE SET
    node_id = EXCLUDED.node_id,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name);

  UPDATE public.node_invites SET claimed_by_user_id = claiming_user_id WHERE token = invite_token;

  RETURN json_build_object('success', true, 'node_id', invite_record.node_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_relative_secure(
  new_node_name text,
  rel_type text,
  target_node_id uuid,
  creator_id uuid,
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

CREATE OR REPLACE FUNCTION public.get_public_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  individual_count INTEGER;
  family_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO individual_count FROM public.nodes;
  SELECT COUNT(DISTINCT paternal_family_cluster) INTO family_count FROM public.nodes
  WHERE paternal_family_cluster IS NOT NULL AND paternal_family_cluster != '';
  RETURN json_build_object('individuals', individual_count, 'families', family_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_claimed_node_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(node_id) FILTER (WHERE node_id IS NOT NULL), ARRAY[]::uuid[])
  FROM public.users
  WHERE node_id IS NOT NULL;
$$;

-- -----------------------------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.get_public_metrics() TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.claim_invite_secure(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_relative_secure(text, text, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_claimed_node_ids() TO authenticated;

-- -----------------------------------------------------------------------------
-- POLICIES (use (select auth.uid()) to avoid RLS initplan issues)
-- -----------------------------------------------------------------------------

CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT TO authenticated
  USING ((id = (select auth.uid())) OR is_admin());

CREATE POLICY users_insert_blocked ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY users_update_admin_only ON public.users
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY users_delete_admin_only ON public.users
  FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY nodes_select_authenticated ON public.nodes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY nodes_insert_by_bound_users ON public.nodes
  FOR INSERT TO authenticated
  WITH CHECK (
    (created_by_user_id = (select auth.uid()))
    AND (EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND node_id IS NOT NULL
    ))
  );

CREATE POLICY nodes_update_1degree_or_admin ON public.nodes
  FOR UPDATE TO authenticated
  USING (is_admin() OR is_within_1_degree(id))
  WITH CHECK (is_admin() OR is_within_1_degree(id));

CREATE POLICY nodes_delete_admin_only ON public.nodes
  FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY links_select_authenticated ON public.links
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY links_insert_1degree_or_admin ON public.links
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id));

CREATE POLICY links_update_1degree_or_admin ON public.links
  FOR UPDATE TO authenticated
  USING (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id))
  WITH CHECK (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id));

CREATE POLICY links_delete_admin_only ON public.links
  FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY node_invites_select ON public.node_invites
  FOR SELECT TO public
  USING (true);

CREATE POLICY node_invites_insert_1degree ON public.node_invites
  FOR INSERT TO authenticated
  WITH CHECK (can_manage_invites_for_node(node_id));

CREATE POLICY node_invites_delete_1degree ON public.node_invites
  FOR DELETE TO authenticated
  USING (can_manage_invites_for_node(node_id));
