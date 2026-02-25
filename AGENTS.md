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
- **Google OAuth requires 2FA**: The test Google account has 2-Step Verification enabled. To complete sign-in, either provide a `TEST_LOGIN_OTP_SEED` secret for TOTP generation, or manually complete 2FA via the Desktop pane. Complete 2FA quickly — OAuth state tokens expire in ~5 minutes.
- **3D mode requires GPU/WebGL**: The cloud VM lacks GPU acceleration, so the 3D canvas (react-force-graph-3d / Three.js) renders blank with `CONTEXT_LOST_WEBGL` errors. Use **2D mode** (Settings → 2D tab) instead — it renders SVG-based family trees without WebGL and is fully functional.
