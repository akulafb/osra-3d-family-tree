-- Verify that the authenticated user matches claiming_user_id (security + correctness)
-- Prevents misuse and handles client state bugs where wrong ID is passed.
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
