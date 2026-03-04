-- Update create_relative_secure to support parent_role and set maternal/paternal clusters

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
BEGIN
  SELECT paternal_family_cluster INTO target_cluster FROM public.nodes WHERE id = target_node_id;

  -- Determine paternal and maternal clusters for new child
  IF rel_type = 'child' AND p_parent_role IS NOT NULL THEN
    -- Find spouse via marriage link
    SELECT CASE
      WHEN l.source_node_id = target_node_id THEN l.target_node_id
      ELSE l.source_node_id
    END INTO spouse_id
    FROM public.links l
    WHERE l.type = 'marriage'
      AND (l.source_node_id = target_node_id OR l.target_node_id = target_node_id)
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
    VALUES (new_id, target_node_id, 'parent', NULL, creator_id);

  ELSIF rel_type = 'child' THEN
    INSERT INTO public.links (source_node_id, target_node_id, type, parent_role, created_by_user_id)
    VALUES (target_node_id, new_id, 'parent', p_parent_role, creator_id);

  ELSIF rel_type = 'spouse' THEN
    INSERT INTO public.links (source_node_id, target_node_id, type, created_by_user_id)
    VALUES (target_node_id, new_id, 'marriage', creator_id);

  ELSIF rel_type = 'sibling' THEN
    FOR parent_id IN
      SELECT source_node_id FROM public.links
      WHERE target_node_id = target_node_id AND type = 'parent'
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

  RETURN json_build_object(
    'success', true,
    'new_node_id', new_id,
    'message', 'Relative added successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$function$;
