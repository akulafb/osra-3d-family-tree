-- RPC to return claimed node IDs for tree display (bypasses RLS for read-only list)
-- Authenticated users can see which nodes are claimed to distinguish "dead ends"

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

GRANT EXECUTE ON FUNCTION public.get_claimed_node_ids() TO authenticated;
