-- Revert from Clerk OIDC back to Supabase native Google OAuth
-- Project: Osra (henhqxosjbrvwceuvtyk)
-- Run this migration on production before deploying reverted frontend.

-- 1. Map all Clerk IDs to auth.users UUIDs (by matching email)
--    Handles both prod (user_3Au7fMw0ZpWQJHYiAGjCxwgNoBK) and dev (user_3At8ymo6fVTdm8PXW19Hbo53SIW)
DO $$
DECLARE
  clerk_id TEXT;
  auth_uuid UUID;
BEGIN
  FOR clerk_id IN SELECT id FROM public.users WHERE id LIKE 'user_%'
  LOOP
    SELECT au.id::UUID INTO auth_uuid
    FROM auth.users au
    JOIN public.users pu ON pu.id = clerk_id
      AND LOWER(TRIM(COALESCE(pu.email, ''))) = LOWER(TRIM(COALESCE(au.email, au.raw_user_meta_data->>'email', '')))
      AND COALESCE(pu.email, '') != ''
    LIMIT 1;

    IF auth_uuid IS NOT NULL THEN
      UPDATE public.node_invites SET claimed_by_user_id = auth_uuid WHERE claimed_by_user_id = clerk_id;
      UPDATE public.node_invites SET created_by_user_id = auth_uuid WHERE created_by_user_id = clerk_id;
      UPDATE public.nodes SET created_by_user_id = auth_uuid WHERE created_by_user_id = clerk_id;
      UPDATE public.audit_log SET actor_user_id = auth_uuid WHERE actor_user_id = clerk_id;
      -- Delete Clerk row (UUID row may already exist for same person); avoid PK conflict
      DELETE FROM public.users WHERE id = clerk_id;
    END IF;
  END LOOP;
END $$;

-- 2. Drop policies and disable RLS for schema changes
DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
DROP POLICY IF EXISTS nodes_select_authenticated ON public.nodes;
DROP POLICY IF EXISTS nodes_insert_by_bound_users ON public.nodes;
DROP POLICY IF EXISTS links_select_authenticated ON public.links;
DROP POLICY IF EXISTS links_insert_1degree_or_admin ON public.links;
DROP POLICY IF EXISTS node_invites_select ON public.node_invites;
DROP POLICY IF EXISTS node_invites_insert_1degree ON public.node_invites;
DROP POLICY IF EXISTS node_invites_delete_1degree ON public.node_invites;
DROP POLICY IF EXISTS audit_log_select_admin ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert_authenticated ON public.audit_log;

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.links DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;

-- 3. Revert column types: TEXT -> UUID
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey CASCADE;
ALTER TABLE public.users ALTER COLUMN id TYPE UUID USING id::uuid;
ALTER TABLE public.users ADD PRIMARY KEY (id);
-- Note: users_id_fkey (FK to auth.users) omitted - placeholder user 00000000-0000-0000-0000-000000000001 is not in auth.users

ALTER TABLE public.nodes ALTER COLUMN created_by_user_id TYPE UUID USING created_by_user_id::uuid;
ALTER TABLE public.links ALTER COLUMN created_by_user_id TYPE UUID USING created_by_user_id::uuid;
ALTER TABLE public.node_invites ALTER COLUMN claimed_by_user_id TYPE UUID USING claimed_by_user_id::uuid;
ALTER TABLE public.node_invites ALTER COLUMN created_by_user_id TYPE UUID USING created_by_user_id::uuid;
ALTER TABLE public.audit_log ALTER COLUMN actor_user_id TYPE UUID USING actor_user_id::uuid;

-- 4. Revert RLS helper functions to use auth.uid()
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_bound()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND node_id IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_within_1_degree(p_target_node_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_invites_for_node(p_node_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN is_admin() OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND node_id = p_node_id
  );
END;
$$;

-- 5. Revert RLS policies to use auth.uid()
DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin ON public.users
FOR SELECT TO authenticated
USING ((id = auth.uid()) OR is_admin());

DROP POLICY IF EXISTS nodes_insert_by_bound_users ON public.nodes;
CREATE POLICY nodes_insert_by_bound_users ON public.nodes
FOR INSERT TO authenticated
WITH CHECK ((created_by_user_id = auth.uid()) AND is_bound());

DROP POLICY IF EXISTS links_insert_1degree_or_admin ON public.links;
CREATE POLICY links_insert_1degree_or_admin ON public.links
FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id));

DROP POLICY IF EXISTS node_invites_insert_1degree ON public.node_invites;
CREATE POLICY node_invites_insert_1degree ON public.node_invites
FOR INSERT TO authenticated
WITH CHECK (can_manage_invites_for_node(node_id));

DROP POLICY IF EXISTS node_invites_delete_1degree ON public.node_invites;
CREATE POLICY node_invites_delete_1degree ON public.node_invites
FOR DELETE TO authenticated
USING (can_manage_invites_for_node(node_id));

DROP POLICY IF EXISTS audit_log_insert_authenticated ON public.audit_log;
CREATE POLICY audit_log_insert_authenticated ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (actor_user_id = auth.uid());

-- 6. Revert claim_invite_secure to UUID signature (Supabase auth)
DROP FUNCTION IF EXISTS public.claim_invite_secure(text, text);
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
GRANT EXECUTE ON FUNCTION public.claim_invite_secure(text, uuid) TO authenticated;

-- 7. Revert create_relative_secure to take creator_id uuid (Supabase auth)
DROP FUNCTION IF EXISTS public.create_relative_secure(text, text, uuid, text);
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
AS $function$
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
$function$;
GRANT EXECUTE ON FUNCTION public.create_relative_secure(text, text, uuid, uuid, text) TO authenticated;

-- 8. Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
