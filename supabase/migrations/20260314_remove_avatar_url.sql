-- Remove avatar_url from public.users

ALTER TABLE public.users DROP COLUMN IF EXISTS avatar_url;

-- Update claim_invite_secure to stop populating avatar_url
CREATE OR REPLACE FUNCTION public.claim_invite_secure(invite_token text, claiming_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record public.node_invites%ROWTYPE;
  existing_user_node_id uuid;
BEGIN
  SELECT * INTO invite_record FROM public.node_invites WHERE token = invite_token;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'invalid_invite', 'message', 'This invite link is not valid');
  END IF;

  IF invite_record.claimed_by_user_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'already_claimed', 'message', 'This invite has already been claimed');
  END IF;

  -- Use text ID for user lookup
  SELECT node_id INTO existing_user_node_id FROM public.users WHERE id = claiming_user_id;
  IF existing_user_node_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'already_bound', 'message', 'You are already bound to a node in the family tree');
  END IF;

  -- Note: We no longer check auth.users because we are using Clerk OIDC.
  -- The user should have been created in public.users via a webhook before claiming.
  -- If not, we still allow the claim by upserting the user record.
  
  INSERT INTO public.users (id, node_id, role)
  VALUES (claiming_user_id, invite_record.node_id, 'user')
  ON CONFLICT (id) DO UPDATE SET
    node_id = EXCLUDED.node_id;

  UPDATE public.node_invites SET claimed_by_user_id = claiming_user_id WHERE token = invite_token;

  RETURN json_build_object('success', true, 'node_id', invite_record.node_id);
END;
$$;
