-- Consolidate multiple permissive SELECT policies on node_invites (Supabase lint 0006)
-- invites_select_public (public, true) + node_invites_select_simple (authenticated, can_manage) 
-- Combined: public read access for invite validation; single policy suffices

DROP POLICY IF EXISTS invites_select_public ON public.node_invites;
DROP POLICY IF EXISTS node_invites_select_simple ON public.node_invites;

CREATE POLICY node_invites_select ON public.node_invites
  FOR SELECT TO public
  USING (true);
