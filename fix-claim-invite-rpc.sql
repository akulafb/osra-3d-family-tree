-- Fix the claim_invite_secure function to remove updated_at reference

CREATE OR REPLACE FUNCTION claim_invite_secure(
  invite_token TEXT,
  claiming_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record node_invites%ROWTYPE;
  existing_user_node_id UUID;
BEGIN
  -- Step 1: Validate invite exists
  SELECT * INTO invite_record
  FROM node_invites
  WHERE token = invite_token;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'invalid_invite',
      'message', 'This invite link is not valid'
    );
  END IF;
  
  -- Step 2: Check if already claimed
  IF invite_record.claimed_by_user_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'already_claimed',
      'message', 'This invite has already been claimed'
    );
  END IF;
  
  -- Step 3: Check if user already has a node binding
  SELECT node_id INTO existing_user_node_id
  FROM users
  WHERE id = claiming_user_id;
  
  IF existing_user_node_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'already_bound',
      'message', 'You are already bound to a node in the family tree'
    );
  END IF;
  
  -- Step 4: Create or update user record (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO users (id, node_id, role)
  VALUES (claiming_user_id, invite_record.node_id, 'user')
  ON CONFLICT (id) 
  DO UPDATE SET 
    node_id = EXCLUDED.node_id;
    -- Removed updated_at since it doesn't exist in users table
  
  -- Step 5: Mark invite as claimed
  UPDATE node_invites
  SET claimed_by_user_id = claiming_user_id
  WHERE token = invite_token;
  
  -- Step 6: Return success with node info
  RETURN json_build_object(
    'success', true,
    'node_id', invite_record.node_id
  );
END;
$$;

-- Ensure permissions are set
GRANT EXECUTE ON FUNCTION claim_invite_secure(TEXT, UUID) TO authenticated;
