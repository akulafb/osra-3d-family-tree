# Dev vs Production Database Setup

## Overview

- **Production** (`your-prod-project-id`): Live app data. Used by Vercel deployment.
- **Development** (`your-dev-project-id`): Local testing. Used when running `npm run dev`.

## Current Setup

| File | Purpose |
|------|---------|
| `.env.local` | Dev Supabase credentials. Loaded by Vite when running `npm run dev`. |
| `.env.production` | Prod credentials. Used for `npm run build` (production mode). Vercel uses its own env vars. |

**Important:** `.env.local` and `.env.production` are gitignored. Never commit them.

## First-time setup

For a new Supabase project, apply the schema with one command: `npx supabase db push` (after linking via `npx supabase link --project-ref YOUR_REF`). See the [README Database Setup](../README.md#database-setup) for full steps.

## Schema Applied to Dev

The dev database has been set up with:

- Tables: `users`, `nodes`, `links`, `node_invites`, `audit_log`
- RLS policies
- Functions: `is_within_1_degree`, `create_relative_secure`, `get_invite_by_token`, `claim_invite_secure`, etc.
- FK indexes

## Optional: Seed Dev with Sample Data

To populate the dev database with sample family tree data:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your dev project
2. Go to **SQL Editor**
3. Run your seed SQL (e.g. from a local `supabase/scripts/` or `supabase/seed/` folder)

**Note:** After sign-in, claim an invite (e.g. the token from your seed SQL) to create your user record and bind to a node. To make yourself admin, run in SQL Editor (replace with your auth user ID from Auth → Users):

```sql
UPDATE users SET role = 'admin' WHERE id = 'your-google-user-uuid';
```

## Google OAuth for Dev

For local sign-in to work:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your dev project
2. Go to **Authentication** → **Providers** → **Google**
3. Enable Google and add your OAuth credentials
4. Under **URL Configuration**:
   - **Redirect URLs**: Add `http://localhost:5173`, `http://127.0.0.1:5173`, and for mobile testing `http://YOUR_IP:5173` (e.g. `http://192.168.1.100:5173`). Find your IP with `ipconfig getifaddr en0` (Mac).
   - **Site URL**: For mobile testing on same Wi‑Fi, temporarily set to `http://YOUR_IP:5173`. Supabase falls back to Site URL when redirectTo doesn't match; changing it ensures OAuth redirects to your phone. Change back to `http://localhost:5173` when done.

## Verification

1. Ensure `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` pointing to the **dev** project.
2. Run `npm run dev` and visit http://localhost:5173
3. Sign in with Google → data is saved to the dev database only.
4. Production at https://3d-family-tree-vert.vercel.app uses the production database.
