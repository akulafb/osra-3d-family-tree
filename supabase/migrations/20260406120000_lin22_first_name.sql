-- LIN-22: Store given name in first_name; paternal/maternal clusters unchanged.
-- Strips trailing duplicate family tokens from legacy combined names (e.g. "Adam Zabalawi Zabalawi").

ALTER TABLE public.nodes RENAME COLUMN name TO first_name;

CREATE OR REPLACE FUNCTION public._lin22_strip_trailing_cluster_from_first_name()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v text;
  orig text;
  c text;
  arr text[];
  n int;
BEGIN
  FOR r IN SELECT id, first_name, paternal_family_cluster FROM public.nodes LOOP
    orig := r.first_name;
    v := trim(regexp_replace(coalesce(r.first_name, ''), '\s+', ' ', 'g'));
    c := nullif(trim(coalesce(r.paternal_family_cluster, '')), '');
    IF c IS NOT NULL THEN
      LOOP
        arr := regexp_split_to_array(v, '\s+');
        n := coalesce(array_length(arr, 1), 0);
        EXIT WHEN n < 2;
        IF lower(arr[n]) = lower(c) THEN
          v := array_to_string(arr[1:n - 1], ' ');
        ELSE
          EXIT;
        END IF;
      END LOOP;
    END IF;
    IF v = '' THEN
      v := trim(coalesce(orig, ''));
    END IF;
    IF v IS DISTINCT FROM orig THEN
      UPDATE public.nodes SET first_name = v WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

SELECT public._lin22_strip_trailing_cluster_from_first_name();
DROP FUNCTION public._lin22_strip_trailing_cluster_from_first_name();

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
    'node_name', trim(both ' ' FROM concat_ws(' ', nullif(trim(n.first_name), ''), nullif(trim(n.paternal_family_cluster), '')))
  ) INTO result
  FROM public.node_invites ni
  JOIN public.nodes n ON n.id = ni.node_id
  WHERE ni.token = invite_token;
  RETURN result;
END;
$$;

-- Legacy 4-arg overload (pre–paternal/maternal schema) conflicts with PostgREST when omitted p_parent_role.
DROP FUNCTION IF EXISTS public.create_relative_secure(text, text, uuid, uuid);

-- Parameter rename requires drop; CREATE OR REPLACE cannot rename arguments.
DROP FUNCTION IF EXISTS public.create_relative_secure(text, text, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.create_relative_secure(
  new_first_name text,
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
  IF auth.uid() IS NULL OR auth.uid() != creator_id THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  IF NOT (is_admin() OR is_within_1_degree(v_target)) THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

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

  INSERT INTO public.nodes (first_name, paternal_family_cluster, maternal_family_cluster, created_by_user_id)
  VALUES (new_first_name, paternal_cluster, maternal_cluster, creator_id)
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

GRANT EXECUTE ON FUNCTION public.create_relative_secure(text, text, uuid, uuid, text) TO authenticated;
