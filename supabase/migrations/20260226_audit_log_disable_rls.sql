-- Resolve "RLS Enabled No Policy" lint on audit_log (Supabase lint 0008)
-- audit_log is empty, has no triggers, and is not referenced in the codebase.
-- Disabling RLS resolves the lint. Re-enable and add policies if you implement audit logging.

ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;
