# audit_log Table Investigation

## Summary

The `audit_log` table has RLS enabled but no policies, causing the Supabase lint "RLS Enabled No Policy" (0008).

## Findings

| Attribute | Value |
|-----------|-------|
| **Schema** | `id` (uuid), `actor_user_id` (uuid), `action` (text), `target_node_id` (uuid), `created_at` (timestamptz) |
| **Row count** | 0 |
| **Triggers** | None reference audit_log |
| **Policies** | None |
| **Codebase references** | None |

## Analysis

- The table appears intended for tracking node-related actions (actor, action, target_node_id).
- No application code or triggers write to it.
- With RLS enabled and no policies, all access is denied (including service role when using the API as anon/authenticated).

## Recommended Fix

**Option A (recommended):** Disable RLS if the table is unused and you have no immediate plans for it. This resolves the lint.

**Option B:** Add policies if you plan to use it:
- For backend-only (triggers): Add policy allowing `service_role` or use `SECURITY DEFINER` functions.
- For user audit trail: Add INSERT policy for authenticated users, SELECT for admins only.

Apply the migration in `supabase/migrations/20260226_audit_log_disable_rls.sql` to implement Option A.
