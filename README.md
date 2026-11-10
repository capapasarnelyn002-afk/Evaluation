<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8823ee4d-6e82-4342-90f8-ebccb9b5ffdd

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Set `GEMINI_API_KEY` if AI reporting is needed. Vite uses the public `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) for browser OAuth; explicit `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values can also be supplied.
3. In the Supabase SQL Editor, run all of [`supabase/schema.sql`](./supabase/schema.sql). Re-run it after pulling schema updates.
4. Run the app:
   `npm run dev`

The server requires Supabase configuration and stores users, activities, forms, evaluations, surveys, responses, audit logs, settings, and themes in separate tables. Successful data-changing requests are committed through a database transaction before the API reports success. It does not create default users or demo records. The SQL creates an Auth trigger that adds application profiles for email/password and invited users. Only active administrator accounts can sign in to the dashboard or call protected application APIs. Google sign-ins are limited to users with an existing application profile. To grant administrator access, run `update public.users set role = 'admin' where email = 'your-user@example.com';` with the appropriate email in the SQL Editor.

## Public activity evaluations

Administrators can publish a form assigned to an active or upcoming extension activity from **Evaluation Form Builder**. The builder provides a public URL and a locally generated QR code. Participants can open `/evaluate/{form-id}` without signing in; `/evaluate` lists currently available public forms. Only published forms with public submissions enabled and an active activity are served. An optional form expiration date and the activity deadline close the link automatically. Public submissions are validated server-side, rate-limited by a database-backed per-form/network window, idempotent on retry, and stored as anonymous evaluation records in the existing evaluation table. To accept the related schema additions, re-run [`supabase/schema.sql`](./supabase/schema.sql).

Protected API requests refresh the Supabase snapshot before handling so separate administrator sessions can see saved changes; the admin client also refreshes on focus and every 30 seconds while visible.

`SUPABASE_SECRET_KEY` is server-only; never prefix it with `VITE_` or expose it in the browser. The app uses Supabase's REST and Auth APIs, so it does not need the PostgreSQL connection string or its database password.

### Enable Google sign-in

Google sign-in uses Supabase OAuth and is limited to users who already have a matching row in `public.users`. New Google accounts are not automatically granted an application profile.

1. In Google Cloud Console, create a **Web application** OAuth client. Add your deployed app origin and `http://localhost:3000` as authorized JavaScript origins. Set the authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`. If the Google consent screen is in testing mode, add allowed Google accounts as test users.
2. In Supabase, open **Authentication → Sign In / Providers → Google**, enable the provider, and enter the Google client ID and client secret.
3. In Supabase **Authentication → URL Configuration**, add the deployed app URL (for example `https://your-project.vercel.app/**`) and local URL (`http://localhost:3000/**`) to the redirect URL allow list.
4. Ensure Vercel has `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` configured for the deployment, or set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to those same public values. Redeploy after changing them because Vite embeds public configuration during the build. Never put the Supabase secret key in a `VITE_` variable.
5. Apply the updated [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. Ensure the Google account has an existing app profile with the correct Auth user ID and `active` status. Google sign-in does not promote users; adjust `role` separately if administrator access is required.

## Deploy to Vercel

Import the repository into Vercel and set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY` in the project environment variables. Set `GEMINI_API_KEY` if AI features are needed. The Vercel API function in [`api/[...path].ts`](./api/[...path].ts) serves the Express API, while Vite's production build is served from `dist`. Run or re-run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor before deploying schema changes. The latest schema includes the atomic `save_website_theme` function used to persist appearance settings separately from unrelated application records. `GET /api/health` checks the API without requiring Supabase; `GET /api/database/status` verifies database access, snapshot loading, and that the appearance-persistence function is installed. Loading the server snapshot does not write or reseed database data.
