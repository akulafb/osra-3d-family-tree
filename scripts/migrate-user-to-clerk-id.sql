-- One-time migration: Map existing user (by email) from old Supabase UUID to Clerk ID
-- Run in Supabase SQL Editor for production.
-- Replace YOUR_CLERK_ID and YOUR_EMAIL with actual values.
-- Get Clerk ID from: Clerk Dashboard → Users, or browser console: Clerk.user.id

DO $$
DECLARE
  v_old_id TEXT;
  v_clerk_id TEXT := 'YOUR_CLERK_ID';  -- e.g. user_3At8ymo6fVTdm8PXW19Hbo53SIW
  v_email TEXT := 'YOUR_EMAIL';        -- e.g. akulafb@gmail.com
BEGIN
  SELECT id INTO v_old_id FROM public.users WHERE email = v_email AND id != v_clerk_id AND id LIKE '%-%-%-%-%' LIMIT 1;
  IF v_old_id IS NULL THEN
    RAISE NOTICE 'No user found with email % and old UUID format', v_email;
    RETURN;
  END IF;

  -- Remove duplicate row first if clerk-sync created one (avoids PK conflict)
  DELETE FROM public.users WHERE id = v_clerk_id AND node_id IS NULL;

  -- Update FKs
  UPDATE public.node_invites SET claimed_by_user_id = v_clerk_id WHERE claimed_by_user_id = v_old_id;
  UPDATE public.node_invites SET created_by_user_id = v_clerk_id WHERE created_by_user_id = v_old_id;
  UPDATE public.nodes SET created_by_user_id = v_clerk_id WHERE created_by_user_id = v_old_id;
  UPDATE public.audit_log SET actor_user_id = v_clerk_id WHERE actor_user_id = v_old_id;

  -- Update users.id
  UPDATE public.users SET id = v_clerk_id WHERE id = v_old_id;

  RAISE NOTICE 'Migrated user % -> %', v_old_id, v_clerk_id;
END $$;
