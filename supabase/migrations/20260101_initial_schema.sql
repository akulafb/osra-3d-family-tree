-- =============================================================================
-- INITIAL SCHEMA - Base tables for Osra 3D Family Tree
-- Run this first on a fresh Supabase project, then run other migrations in order.
-- =============================================================================

-- Users: extends auth.users, stores node binding and role
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id uuid,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Nodes: people in the family tree
CREATE TABLE IF NOT EXISTS public.nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  family_cluster text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Links: relationships between nodes
CREATE TABLE IF NOT EXISTS public.links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('parent', 'marriage', 'divorce')),
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Node invites: tokens for binding users to nodes
CREATE TABLE IF NOT EXISTS public.node_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  claimed_by_user_id uuid,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit log: optional, for tracking actions
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  target_node_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
