-- =============================================================================
-- Migration: Migrate User IDs from UUID to TEXT for Clerk Auth integration
-- =============================================================================

-- Disable RLS temporarily to avoid issues during column type changes
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.links DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;

-- 1. Drop existing foreign key constraints that reference auth.users or public.users
-- The initial schema defined: public.users(id) REFERENCES auth.users(id)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Alter column types from UUID to TEXT
-- Note: We use USING col::TEXT to ensure data is preserved during conversion.

-- public.users: Change PK 'id' to TEXT (Clerk IDs are strings)
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- public.nodes: Change 'created_by_user_id' to TEXT
ALTER TABLE public.nodes ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT;

-- public.links: Change 'created_by_user_id' to TEXT
ALTER TABLE public.links ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT;

-- public.node_invites: Change 'claimed_by_user_id' and 'created_by_user_id' to TEXT
ALTER TABLE public.node_invites ALTER COLUMN claimed_by_user_id TYPE TEXT USING claimed_by_user_id::TEXT;
ALTER TABLE public.node_invites ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT;

-- public.audit_log: Change 'actor_user_id' to TEXT
ALTER TABLE public.audit_log ALTER COLUMN actor_user_id TYPE TEXT USING actor_user_id::TEXT;

-- 3. Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
