-- Fix function search_path to prevent search path injection (Supabase lint 0011)
-- Both functions are used in RLS and must have immutable search_path

CREATE OR REPLACE FUNCTION public.is_within_1_degree(p_target_node_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    user_node_id uuid;
BEGIN
    -- Get the node_id bound to the current user
    SELECT node_id INTO user_node_id FROM public.users WHERE id = auth.uid();
    
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

    RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_relative_secure(new_node_name text, rel_type text, target_node_id uuid, creator_id uuid)
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
    FOR parent_id IN 
      SELECT source_node_id FROM public.links 
      WHERE target_node_id = target_node_id AND type = 'parent'
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
