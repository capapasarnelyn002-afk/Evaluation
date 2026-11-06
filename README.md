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
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`.
3. In the Supabase SQL Editor, run all of [`supabase/schema.sql`](./supabase/schema.sql).
4. Run the app:
   `npm run dev`

The server requires Supabase configuration and stores users, activities, forms, evaluations, surveys, responses, audit logs, settings, and themes in separate tables. Successful data-changing requests are committed through a database transaction before the API reports success. Demo/sample records are no longer created; the app seeds only a single demo administrator account when no users exist. The SQL creates an Auth trigger that adds an application profile whenever a Supabase Auth user is created; create users in Supabase Auth or use the administrator invitation screen. New profiles are participants by default. To grant administrator access, run `update public.users set role = 'admin' where email = 'admin@example.com';` with the appropriate email in the SQL Editor.

`SUPABASE_SECRET_KEY` is server-only; never prefix it with `VITE_` or expose it in the browser. The app uses Supabase's REST and Auth APIs, so it does not need the PostgreSQL connection string or its database password.

## Deploy to Vercel

Import the repository into Vercel and set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` in the project environment variables. Set `GEMINI_API_KEY` if AI features are needed. The Vercel API function in [`api/[...path].ts`](./api/[...path].ts) serves the Express API, while Vite's production build is served from `dist`. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor before deploying, then redeploy after adding or changing environment variables. The login page's database indicator can help diagnose missing schema or invalid server credentials.
