# Clerk Auth Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Osra from Supabase Auth to Clerk Auth using the OIDC Wrapper and Clerk Foreign Data Wrapper.

**Architecture:** We will replace the native Supabase Auth flow with Clerk. Supabase will be configured to trust Clerk's JWTs (OIDC). We will migrate the `public.users.id` and all associated foreign keys from `UUID` to `TEXT` to match Clerk's User ID format.

**Tech Stack:** React, Clerk React SDK, Supabase JS SDK, Supabase Edge Functions, Postgres (clerk_fdw).

---

### Task 1: Database Migration (UUID to TEXT)

**Files:**
- Create: `supabase/migrations/20260313_migrate_uuid_to_text.sql`
- Modify: `src/types/database.ts` (after running `npm run build` to update types if possible, or manual update)

**Step 1: Write migration script to convert ID columns**
We need to drop foreign keys, change column types, and recreate them.

```sql
-- Disable RLS temporarily to avoid issues during migration
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.links DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites DISABLE ROW LEVEL SECURITY;

-- 1. Drop existing foreign key constraints
ALTER TABLE public.nodes DROP CONSTRAINT IF EXISTS nodes_created_by_user_id_fkey;
ALTER TABLE public.links DROP CONSTRAINT IF EXISTS links_created_by_user_id_fkey;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey; -- REFERENCES auth.users

-- 2. Alter column types
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.nodes ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT;
ALTER TABLE public.links ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT;

-- 3. Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_invites ENABLE ROW LEVEL SECURITY;
```

**Step 2: Run migration via Supabase CLI (mocked for now or applied via SQL Editor instructions)**
Since I'm an agent, I'll assume the migration needs to be applied to the local/staging DB.

**Step 3: Commit**
```bash
git add supabase/migrations/20260313_migrate_uuid_to_text.sql
git commit -m "db: migrate user IDs from UUID to TEXT for Clerk integration"
```

### Task 2: Supabase OIDC Configuration

**Files:**
- Modify: `.env.local`

**Step 1: Document the required Supabase Dashboard changes**
(This cannot be done via code, but I will provide the instructions in the plan).
- Go to Supabase -> Auth -> Providers -> Third-Party Auth.
- Set Issuer: `https://<your-clerk-instance>.clerk.accounts.dev`
- Set JWKS URL: `https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json`

**Step 2: Update .env.local with Clerk keys**
Add:
- `VITE_CLERK_PUBLISHABLE_KEY=...`

### Task 3: Clerk Webhook Sync (Edge Function)

**Files:**
- Create: `supabase/functions/clerk-sync/index.ts`

**Step 1: Write the Edge Function to handle Clerk user.created and user.updated**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { type, data } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (type === 'user.created' || type === 'user.updated') {
    const { id, first_name, last_name, image_url, email_addresses } = data
    const email = email_addresses[0]?.email_address
    const full_name = `${first_name} ${last_name}`.trim()

    const { error } = await supabase
      .from('users')
      .upsert({
        id,
        full_name,
        avatar_url: image_url,
        email,
        updated_at: new Error().toISOString() // Or use data.updated_at
      })

    if (error) return new Response(JSON.stringify(error), { status: 400 })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
```

**Step 2: Commit**
```bash
git add supabase/functions/clerk-sync/index.ts
git commit -m "feat: add Supabase Edge Function for Clerk webhook sync"
```

### Task 4: Frontend Migration (Clerk SDK)

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`
- Modify: `src/lib/supabase.ts`
- Modify: `src/contexts/AuthContext.tsx`

**Step 1: Install Clerk SDK**
Run: `npm install @clerk/clerk-react`

**Step 2: Update Supabase Client to use Clerk JWT**
In `src/lib/supabase.ts`, we'll need to pass the Clerk token to the Supabase client.

**Step 3: Update AuthContext to wrap Clerk**
Replace Supabase-specific state with Clerk hooks (`useUser`, `useSession`).

**Step 4: Commit**
```bash
git add package.json src/main.tsx src/lib/supabase.ts src/contexts/AuthContext.tsx
git commit -m "feat: replace Supabase Auth with Clerk React SDK"
```

### Task 5: Verification

**Step 1: Test user login flow**
- Verify sign-in redirects to Clerk.
- Verify user profile is created in `public.users` via webhook.
- Verify RLS policies still allow access to nodes/links.
