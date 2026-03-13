-- Add full_name and avatar_url to public.users (from auth.users raw_user_meta_data)
-- Populated when users claim invites; backfilled for existing users.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Update claim_invite_secure to populate profile fields from auth.users
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

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = claiming_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'auth_not_found', 'message', 'Unable to retrieve profile');
  END IF;

  INSERT INTO public.users (id, node_id, role, full_name, avatar_url)
  SELECT
    claiming_user_id,
    invite_record.node_id,
    'user',
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name'),
    COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture')
  FROM auth.users au
  WHERE au.id = claiming_user_id
  ON CONFLICT (id) DO UPDATE SET
    node_id = EXCLUDED.node_id,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);

  UPDATE public.node_invites SET claimed_by_user_id = claiming_user_id WHERE token = invite_token;

  RETURN json_build_object('success', true, 'node_id', invite_record.node_id);
END;
$$;

-- Backfill existing users from auth.users
UPDATE public.users u
SET
  full_name = COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name'),
  avatar_url = COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture')
FROM auth.users au
WHERE u.id = au.id
  AND (u.full_name IS NULL OR u.avatar_url IS NULL);
