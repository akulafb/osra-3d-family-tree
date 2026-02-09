-- ============================================================================
-- RPC: CREATE RELATIVE SECURE
-- ============================================================================
-- Handles creating a person and their relationship link in one atomic step.
-- Prevents "orphan nodes" and enforces 1-degree security.

CREATE OR REPLACE FUNCTION create_relative_secure(
  new_node_name TEXT,
  rel_type TEXT, -- 'parent', 'child', 'spouse'
  target_node_id UUID,
  creator_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to ensure atomicity
SET search_path = public
AS $$
DECLARE
  new_node_id UUID;
  source_id UUID;
  target_id UUID;
  link_type TEXT;
  target_cluster TEXT;
BEGIN
  -- 1. Security Check: Is the creator allowed to edit the target_node?
  -- We reuse our existing logic.
  IF NOT (is_admin() OR is_within_1_degree(target_node_id)) THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized', 'message', 'You do not have permission to add relatives to this person.');
  END IF;

  -- 2. Get the cluster from the target node to keep the new node in the same family
  SELECT family_cluster INTO target_cluster FROM nodes WHERE id = target_node_id;

  -- 3. Create the New Node
  INSERT INTO nodes (name, family_cluster, created_by_user_id)
  VALUES (new_node_name, target_cluster, creator_id)
  RETURNING id INTO new_node_id;

  -- 4. Determine Link Direction & Type
  link_type := 'parent';
  
  IF rel_type = 'child' THEN
    source_id := target_node_id;
    target_id := new_node_id;
  ELSIF rel_type = 'parent' THEN
    source_id := new_node_id;
    target_id := target_node_id;
  ELSIF rel_type = 'spouse' THEN
    source_id := target_node_id;
    target_id := new_node_id;
    link_type := 'marriage';
  ELSE
    RAISE EXCEPTION 'Invalid relationship type: %', rel_type;
  END IF;

  -- 5. Create the Link
  INSERT INTO links (source_node_id, target_node_id, type, created_by_user_id)
  VALUES (source_id, target_id, link_type, creator_id);

  -- 6. Return Success
  RETURN json_build_object(
    'success', true,
    'new_node_id', new_node_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLSTATE, 'message', SQLERRM);
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION create_relative_secure TO authenticated;
