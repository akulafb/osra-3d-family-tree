# Supabase OIDC Configuration for Clerk

This document provides step-by-step instructions to configure Supabase to trust Clerk as a third-party auth provider (OIDC).

## Overview

We are configuring Supabase to accept Clerk's JWTs. This allows using Clerk for authentication while still leveraging Supabase's Row Level Security (RLS) with Clerk-issued user IDs.

---

## 1. Clerk Dashboard Setup

### A. Create "supabase" JWT Template

1. Go to the [Clerk Dashboard](https://dashboard.clerk.com/) -> **JWT Templates**.
2. Click **New Template** and select **Blank** (Important: Do NOT select the "Supabase" template, as it is for the legacy integration).
3. Name it `supabase`.
4. Configure the template settings:
    - **Name:** `supabase`
    - **Issuer:** (Default Clerk Issuer)
    - **Audience (`aud`):** `authenticated` (Required for Supabase RLS)
    - **Custom signing key:** Keep this **OFF**.
    - **Claims:** Use the following JSON (Note: Do NOT add a `sub` claim, as Clerk handles this automatically as a reserved claim):

      ```json
      {
        "aud": "authenticated",
        "role": "authenticated",
        "email": "{{user.primary_email_address}}",
        "app_metadata": {},
        "user_metadata": {}
      }
      ```

5. Click **Apply Changes**.

### B. Retrieve OIDC URLs

1. In the Clerk Dashboard, go to **API Keys**.
2. Locate your **Frontend API URL** (e.g., `https://[your-app-id].clerk.accounts.dev`).
3. Your **Issuer URL** is your Frontend API URL.
4. Your **JWKS URL** is `[Frontend API URL]/.well-known/jwks.json`.

---

## 2. Supabase Dashboard Setup

### A. Configure OIDC Provider

1. Go to the [Supabase Dashboard](https://app.supabase.com/) -> **Auth** -> **Providers**.
2. Select **Third-Party Auth** -> **OIDC**.
3. Fill in the details:
    - **Issuer URL:** Use the Issuer URL from Clerk.
    - **JWKS URL:** Use the JWKS URL from Clerk.
    - **Claim Mapping:** (Important) Do NOT map the `sub` claim to `auth.uid()`, as Clerk IDs are strings and `auth.uid()` expects UUIDs. Leave the mapping empty or map it to a custom field. The application uses `auth.jwt() ->> 'sub'` directly.
4. Save the changes.

---

## 3. Webhook Configuration (User Sync)

To keep your `public.users` table in sync with Clerk, you must connect Clerk's webhooks to the Supabase Edge Function.

### A. Deploy the Edge Function

1. Open your terminal in the project root.
2. Run: `supabase functions deploy clerk-sync`
3. Note the **Endpoint URL** provided in the output (e.g., `https://[id].supabase.co/functions/v1/clerk-sync`).

### B. Configure Clerk Webhook

1. Go to the [Clerk Dashboard](https://dashboard.clerk.com/) -> **Webhooks**.
2. Click **Add Endpoint**.
3. **Endpoint URL:** Paste the Supabase Edge Function URL from the step above.
4. **Events to subscribe to:** Select `user.created` and `user.updated`.
5. Click **Create**.

---

## 4. Environment Variables

Update your `.env.local` file with your Clerk Publishable Key:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
```

---

## Technical Details

- **Issuer URL Pattern:** `https://<your-clerk-instance>.clerk.accounts.dev`
- **JWKS URL Pattern:** `https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json`
- **Audience (`aud`):** The JWT must contain `aud: authenticated` for Supabase to recognize the user as authenticated in RLS.
- **Subject (`sub`):** The `sub` claim from Clerk (the user ID) maps directly to `auth.uid()` in Supabase.
