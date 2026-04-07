-- RLS is evaluated for the invoking user inside SECURITY DEFINER functions, so DELETE
-- could match 0 rows even when is_admin() passed. Disable row_security for this RPC only.

CREATE OR REPLACE FUNCTION public.admin_delete_node_secure(p_node_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Not authorized');
  END IF;

  DELETE FROM public.nodes WHERE id = p_node_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object('success', false, 'message', 'No row was deleted.');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

ALTER FUNCTION public.admin_delete_node_secure(uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.admin_delete_node_secure(uuid) TO authenticated;
