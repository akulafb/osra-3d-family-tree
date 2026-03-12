-- Fix: Add spouse's children to 1-degree permission logic
-- Allows parents to see/invite their children even if only linked to one parent

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

    -- Case 6: Child of a Spouse (New)
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
$function$;
