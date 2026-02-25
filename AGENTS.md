# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
Osra is a 3D Family Tree visualization SPA built with React 18, TypeScript, and Vite. It uses Supabase (cloud-hosted) for auth/database — there is no local backend server.

### Development commands
See `package.json` scripts:
- `npm run dev` — Vite dev server on http://localhost:5173
- `npm run build` — TypeScript check + Vite production build
- `npm run lint` — ESLint (has pre-existing `no-explicit-any` warnings)
- `npm run preview` — preview production build

### Environment variables
A `.env.local` file is required with:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key

Without valid Supabase credentials, the app will render the landing page but authentication and data features won't work. The app throws on startup if these env vars are missing entirely.

Optional:
- `VITE_OPENROUTER_API_KEY` — for cloud AI chatbot
- `VITE_LLM_MODE=local` — to use Ollama instead of OpenRouter

### Key caveats
- No automated test framework is configured (no jest/vitest).
- Lint (`npm run lint`) exits with code 1 due to pre-existing `@typescript-eslint/no-explicit-any` errors; this is expected.
- The Supabase client in `src/lib/supabase.ts` throws immediately if env vars are empty strings or undefined, so `.env.local` must exist with at least placeholder values.
- No Docker or local database setup is needed — all backend is Supabase cloud.
- **Landing page CSS layering bug**: The Hangar section (`zIndex: 30`, `position: fixed`, `inset: 0`) covers the hero section (`zIndex: 10`) at all scroll positions. Since CSS `opacity: 0` does not disable pointer-events, the invisible Hangar overlay blocks clicks on the hero "Sign in with Google" button. To test OAuth, navigate directly to `${VITE_SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=http://localhost:5173` or scroll to the very bottom where the Hangar section becomes visible with its own sign-in button.
- **Google OAuth requires 2FA**: The test Google account has 2-Step Verification enabled. To complete sign-in, either provide a `TEST_LOGIN_OTP_SEED` secret for TOTP generation, or manually complete 2FA via the Desktop pane.
