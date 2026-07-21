# AUTOGRAFF — Supabase hearts/credits backend (Stage 1)

Nothing here touches the live site until you do the steps below. The economy runs
**alongside** the existing Upstash KV "likes" (parallel, per decision). All balance
and heart mutations are server-side; the client may only request.

## What's in this folder
- `migrations/0001_autograff_economy.sql` — the full schema: 5 core tables + `archive`/`vault`
  stubs + `app_config`, **RLS on every table**, append-only `credit_ledger` (trigger-enforced),
  the atomic `give_heart()` function, `reset_daily_hearts()`, and a `ledger_reconciliation` view.
- `stage1-server/` — server glue, staged out of the deploy path. Move into place during setup.
- `stage1-server/local-demo.mjs` — proves the whole economy with no cloud/Docker (see below).

## Prove it works right now (no Supabase needed)
```
cd supabase/stage1-server && npm i @electric-sql/pglite && node local-demo.mjs
```
Runs the real migration against an in-process Postgres 16 and asserts free hearts, paid
hearts, self-heart block, tier-gated infinity, separate infinity tracking, ledger
reconciliation (drift = 0), append-only enforcement, and the rate limit. Expect `16 passed, 0 failed`.

## Go live (~10 min once you have a project slot)
1. **Create the project.** You're at the 2-free-project limit — pause an unused free project,
   upgrade the org, or create `autograff` in region `us-east-1` (co-located with the Vercel functions).
2. **Apply the migration** — paste `migrations/0001_autograff_economy.sql` into the Supabase SQL editor
   (or `supabase db push`). *(I can do this via the Supabase tools the moment the project exists.)*
3. **Enable Anonymous sign-ins:** Dashboard → Authentication → Providers → Anonymous → on.
   (Preserves the current no-login UX; Stage 3 will upgrade anon users to real accounts for payments.)
4. **Install the client:** `npm i @supabase/supabase-js`
5. **Move the server files into place:**
   - `stage1-server/supabase-server.js`      → `lib/supabase-server.js`
   - `stage1-server/give-heart.js`           → `api/give-heart.js`
   - `stage1-server/hearts-daily-reset.js`   → `api/hearts-daily-reset.js`
6. **Add the daily cron** — create `vercel.json` (or merge):
   ```json
   { "crons": [ { "path": "/api/hearts-daily-reset", "schedule": "0 0 * * *" } ] }
   ```
7. **Set env vars** (Vercel project + local `.env`). Never expose the service role key client-side:
   ```
   SUPABASE_URL=                     # https://<ref>.supabase.co
   SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=        # server only
   VITE_SUPABASE_URL=                # same URL, exposed to the browser
   VITE_SUPABASE_ANON_KEY=           # same anon key
   CRON_SECRET=                      # protects the reset cron
   ```
8. Deploy. The `give-heart` and cron endpoints return **503** until the env is set, so they're
   safe to ship early.

## Tuning without a deploy
Everything tunable lives in one row: `update public.app_config set config = ... where id = 1;`
— per-tier daily hearts, standard/infinity credit costs, credit pack sizes/prices, tier
thresholds/prices, and the rate limit.

## Still to build after provisioning (Stage 1 finish)
The browser piece: anonymous sign-in on load + a design-system heart control (black,
Helvetica/Impact, accepts the future SVG seal) that POSTs to `/api/give-heart`. Held back
deliberately so it's tested against the live DB rather than shipped blind.
