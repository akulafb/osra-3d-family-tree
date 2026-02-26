-- Fix RLS auth initplan: wrap auth.uid() in (select auth.uid()) so it evaluates once per query (Supabase lint 0003)

DROP POLICY IF EXISTS nodes_insert_by_bound_users ON public.nodes;
CREATE POLICY nodes_insert_by_bound_users ON public.nodes
  FOR INSERT TO authenticated
  WITH CHECK (
    (created_by_user_id = (select auth.uid()))
    AND (EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND node_id IS NOT NULL
    ))
  );

DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT TO authenticated
  USING ((id = (select auth.uid())) OR is_admin());
