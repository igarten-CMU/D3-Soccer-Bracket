# Codex handoff — D3 Soccer Bracket 2026 Men's Championship

## Goal
Finish, customize and deploy a private March Madness-style bracket challenge for the **actual 2026 NCAA Division III men's soccer tournament**. The current repository includes a polished responsive vanilla JavaScript interface, the official tournament entrants/matchups, bracket logic, leaderboards, and a Supabase backend schema with authentication and row-level security.

## First commands in Codex

```bash
npm test
npm start
```

Open `http://localhost:8080`. No package installation is required. The default `config.js` values are blank, so the app enters **local preview mode** (browser-local storage only).

## Production checklist

1. In a fresh Supabase project, execute `schema.sql` using SQL Editor. If an older schema already ran, execute `permissions.sql`, `official-results.sql`, and `delete-league.sql` instead.
2. Set `supabaseUrl` and `supabaseAnonKey` in `config.js`, **never** a service-role key.
3. Enable email/password authentication and signups, then disable Confirm Email in Supabase Auth. No SMTP setup is required.
4. Link the Supabase CLI and deploy `sync-ncaa-results`; schedule it with Supabase Cron as `*/30 * * * *` using the project's secret API key in Vault.
5. Deploy the static files to Netlify, Vercel or Cloudflare Pages.
6. Verify sign-in, group creation, invite link from a second browser, two users making picks, picks persisting after reload, and a successful `official_results.synced_at` value after manually running the Cron job once.
7. Check the production lock at **2026-11-13 17:00 UTC (Friday 12:00 PM ET)**. Pick writes are blocked by SQL RLS even if the browser clock is wrong.

## Files

- `index.html`, `styles.css`, `app.js` — UI and interactions
- `data.js` — official 64-team bracket, game progression, points, and tests' source data
- `store.js` — real Supabase storage and offline browser-local preview
- `schema.sql` — PostgreSQL tables, NCAA fixture seed, RLS policies, validation, RPCs
- `permissions.sql` — idempotent explicit grants for a project that already ran an older schema
- `official-results.sql` — one-time results-table migration for an existing project
- `delete-league.sql` — one-time owner-only league deletion migration for an existing project
- `supabase/functions/sync-ncaa-results/` — protected NCAA importer
- `supabase/functions/_shared/ncaa-results.js` — NCAA parser with OT/2OT/PK-safe winner handling
- `config.js` — **public** client configuration; fill locally before production deployment
- `tests/bracket.test.mjs` — built-in Node tests
- `preview.png` — website screenshot
- `README.md` — complete operating and deployment instructions

## Current behavior / intentional limitations

- Shared groups and multi-device saves are **only live after Supabase is connected and the site is deployed**. No deployed URL or production database is included.
- Accounts use unverified email/password login. Authentication emails and password resets are intentionally unavailable, so players must retain their passwords.
- Finalized winners are imported from official NCAA data every 30 minutes. Browser users and challenge organizers cannot write results.
- The importer trusts NCAA's explicit `isWinner` flag rather than the displayed soccer score, so OT, 2OT and penalty-kick decisions are handled correctly.
- The NCAA GraphQL endpoint is official but undocumented. A query change is recorded in `official_results.last_error` without replacing the last known-good scores.
- Points per correct winner by round: 10, 20, 40, 80, 160, 320. Perfect bracket: 1,920.
- Participants' picks are hidden from other participants before the deadline.
- The interface is optimized for smaller-screen use and has four sectional tabs and a Final Four tab.

## Source of tournament data

Official NCAA Division III men's soccer 2026 bracket:
https://www.ncaa.com/brackets/soccer-men/d3/2026

## Good next improvements

- Add an integration test using a temporary Supabase project to test auth/RLS/real-time updates and verify SQL setup.
- Add alerting for a non-empty `official_results.last_error` if this becomes a long-lived public product.
- Add group-specific scoring breakdowns, pick-sharing views after lock, and a bracket export image/PDF.
- Add a verified email or social-login recovery path later if account recovery becomes important.
