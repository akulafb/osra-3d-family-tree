-- Production Migration: Clerk OIDC Authentication Switch
-- Project: Osra (henhqxosjbrvwceuvtyk)
-- Date: 2026-03-13

-- 1. PREPARATION: Disable RLS temporarily to avoid conflicts during schema changes
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.links DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;

-- 2. SCHEMA TRANSITION: Convert UUID columns to TEXT
-- Drop primary/foreign key constraints temporarily
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pkey CASCADE;
ALTER TABLE public.nodes DROP CONSTRAINT IF EXISTS nodes_pkey CASCADE;
ALTER TABLE public.links DROP CONSTRAINT IF EXISTS links_pkey CASCADE;
ALTER TABLE public.node_invites DROP CONSTRAINT IF EXISTS node_invites_pkey CASCADE;
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_pkey CASCADE;

-- Alter column types
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.nodes ALTER COLUMN id TYPE UUID USING id::UUID; -- Keep node IDs as UUID
ALTER TABLE public.nodes ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT;
ALTER TABLE public.links ALTER COLUMN id TYPE UUID USING id::UUID; -- Keep link IDs as UUID
ALTER TABLE public.links ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT;
ALTER TABLE public.node_invites ALTER COLUMN id TYPE UUID USING id::UUID; -- Keep invite IDs as UUID
ALTER TABLE public.node_invites ALTER COLUMN claimed_by_user_id TYPE TEXT USING claimed_by_user_id::TEXT;
ALTER TABLE public.node_invites ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT;
ALTER TABLE public.audit_log ALTER COLUMN id TYPE UUID USING id::UUID; -- Keep audit IDs as UUID
ALTER TABLE public.audit_log ALTER COLUMN actor_user_id TYPE TEXT USING actor_user_id::TEXT;

-- Re-add Primary Keys
ALTER TABLE public.users ADD PRIMARY KEY (id);
ALTER TABLE public.nodes ADD PRIMARY KEY (id);
ALTER TABLE public.links ADD PRIMARY KEY (id);
ALTER TABLE public.node_invites ADD PRIMARY KEY (id);
ALTER TABLE public.audit_log ADD PRIMARY KEY (id);

-- 3. SECURITY DEFINER HELPERS: Optimized for Clerk (String IDs)
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (auth.jwt() ->> 'sub') AND role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_bound()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (auth.jwt() ->> 'sub') AND node_id IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_within_1_degree(p_target_node_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_user_node_id uuid;
  v_current_user_id text := (auth.jwt() ->> 'sub');
BEGIN
  SELECT node_id INTO v_user_node_id FROM public.users WHERE id = v_current_user_id;
  IF v_user_node_id IS NULL THEN RETURN false; END IF;
  IF v_user_node_id = p_target_node_id THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.links
    WHERE (source_node_id = v_user_node_id AND target_node_id = p_target_node_id)
       OR (source_node_id = p_target_node_id AND target_node_id = v_user_node_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_invites_for_node(p_node_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN is_admin() OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (auth.jwt() ->> 'sub') AND node_id = p_node_id
  );
END;
$$;

-- 4. RLS POLICIES: Clean Recreation
-- Users
DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin ON public.users
FOR SELECT TO authenticated
USING (
  (id = (auth.jwt() ->> 'sub')) OR is_admin()
);

-- Nodes
DROP POLICY IF EXISTS nodes_select_authenticated ON public.nodes;
CREATE POLICY nodes_select_authenticated ON public.nodes
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS nodes_insert_by_bound_users ON public.nodes;
CREATE POLICY nodes_insert_by_bound_users ON public.nodes
FOR INSERT TO authenticated
WITH CHECK (
  (created_by_user_id = (auth.jwt() ->> 'sub')) AND is_bound()
);

-- Links
DROP POLICY IF EXISTS links_select_authenticated ON public.links;
CREATE POLICY links_select_authenticated ON public.links
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS links_insert_1degree_or_admin ON public.links;
CREATE POLICY links_insert_1degree_or_admin ON public.links
FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_within_1_degree(source_node_id) OR is_within_1_degree(target_node_id));

-- Node Invites
DROP POLICY IF EXISTS node_invites_select ON public.node_invites;
CREATE POLICY node_invites_select ON public.node_invites
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS node_invites_insert_1degree ON public.node_invites;
CREATE POLICY node_invites_insert_1degree ON public.node_invites
FOR INSERT TO authenticated
WITH CHECK (can_manage_invites_for_node(node_id));

DROP POLICY IF EXISTS node_invites_delete_1degree ON public.node_invites;
CREATE POLICY node_invites_delete_1degree ON public.node_invites
FOR DELETE TO authenticated
USING (can_manage_invites_for_node(node_id));

-- Audit Log
DROP POLICY IF EXISTS audit_log_select_admin ON public.audit_log;
CREATE POLICY audit_log_select_admin ON public.audit_log
FOR SELECT TO authenticated
USING (is_admin());

DROP POLICY IF EXISTS audit_log_insert_authenticated ON public.audit_log;
CREATE POLICY audit_log_insert_authenticated ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (actor_user_id = (auth.jwt() ->> 'sub'));

-- 5. FINALIZATION: Re-enable RLS and Flush Cache
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
