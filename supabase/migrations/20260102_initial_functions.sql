-- =============================================================================
-- INITIAL FUNCTIONS - RPC and helper functions
-- =============================================================================

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

CREATE OR REPLACE FUNCTION public.create_relative_secure(new_node_name text, rel_type text, target_node_id uuid, creator_id uuid)
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
BEGIN
  SELECT family_cluster INTO target_cluster FROM public.nodes WHERE id = target_node_id;
  INSERT INTO public.nodes (name, family_cluster, created_by_user_id)
  VALUES (new_node_name, target_cluster, creator_id)
  RETURNING id INTO new_id;

  IF rel_type = 'parent' THEN
    INSERT INTO public.links (source_node_id, target_node_id, type, created_by_user_id)
    VALUES (new_id, target_node_id, 'parent', creator_id);
  ELSIF rel_type = 'child' THEN
    INSERT INTO public.links (source_node_id, target_node_id, type, created_by_user_id)
    VALUES (target_node_id, new_id, 'parent', creator_id);
  ELSIF rel_type = 'spouse' THEN
    INSERT INTO public.links (source_node_id, target_node_id, type, created_by_user_id)
    VALUES (target_node_id, new_id, 'marriage', creator_id);
  ELSIF rel_type = 'sibling' THEN
    FOR parent_id IN SELECT source_node_id FROM public.links WHERE target_node_id = target_node_id AND type = 'parent'
    LOOP
      INSERT INTO public.links (source_node_id, target_node_id, type, created_by_user_id)
      VALUES (parent_id, new_id, 'parent', creator_id);
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
  SELECT COUNT(DISTINCT family_cluster) INTO family_count FROM public.nodes
  WHERE family_cluster IS NOT NULL AND family_cluster != '';
  RETURN json_build_object('individuals', individual_count, 'families', family_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_metrics() TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.claim_invite_secure(text, uuid) TO authenticated;
