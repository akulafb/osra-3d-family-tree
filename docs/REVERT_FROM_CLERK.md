# Revert from Clerk to Supabase Google OAuth

This document describes the revert from Clerk OIDC back to pure Supabase native Google OAuth.

## What Was Done

### 1. Database migration (already applied via MCP)

- Mapped Fahd's Clerk ID back to auth.users UUID (`952db081-34ec-41a1-bf97-332867926b63`)
- Reverted `users.id` and all FK columns from TEXT to UUID
- Reverted RLS policies and helper functions to use `auth.uid()`
- Reverted `claim_invite_secure` and `create_relative_secure` to UUID signatures

### 2. Frontend code (already reverted)

- `AuthContext.tsx` – Supabase auth with `signInWithOAuth`, `onAuthStateChange`
- `main.tsx` – Removed `ClerkProvider`
- `HomePage.tsx` – Removed Clerk ID display and debug logs
- `InvitePage.tsx` – Uses `session?.access_token`, passes `claiming_user_id` to RPC
- `AddRelativeModal.tsx` – Passes `creator_id` to `create_relative_secure`
- `BulkInviteModal.tsx`, `EditNodeModal.tsx`, `useFamilyData.ts` – `access_token`
- `index.html` – Removed debug instrumentation
- `supabase.ts` – Restored `persistSession: true`, `autoRefreshToken: true`

## What You Must Do

### 1. Remove Clerk package

```bash
npm uninstall @clerk/clerk-react
```

### 2. Supabase Dashboard – enable Google OAuth

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Providers**
2. Enable **Google**
3. Add your Google OAuth Client ID and Client Secret (from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))
4. Add authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. **Disable or remove** the Clerk OIDC provider if it exists (Authentication → Providers)

### 3. Environment variables

Remove from `.env.local` and `.env.production` (and Vercel):

- `VITE_CLERK_PUBLISHABLE_KEY`

Keep:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 4. Build and test

```bash
npm run build
npm run preview
```

Sign in with Google and verify the tree loads.

## Migration file

The revert migration is in `supabase/migrations/20260315_revert_clerk_to_supabase_auth.sql`. It has already been applied to production. For a fresh dev database, run migrations in order.

## Cleanup (done)

Removed: `supabase/functions/clerk-sync/`, `scripts/migrate-user-to-clerk-id.sql`, `scripts/migrate-all-users-to-clerk.mjs`, `docs/setup/CLERK_SUPABASE_OIDC_SETUP.md`, `docs/plans/2026-03-13-clerk-auth-migration-*.md`
