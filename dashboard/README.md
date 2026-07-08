# LMSpend Dashboard

Next.js app: the paid layer. Supabase auth (magic link + GitHub) and Postgres, opt-in aggregate syncs from the CLI, Kora (Korapay) card payments in USD (individual-business friendly for Nigeria — see [docs/payments.md](../docs/payments.md)), Resend emails, share links with OG preview cards.

Runs in two modes automatically:
- **Dev mode** (no Supabase env vars): no sign-in, in-memory data, `dev-key-123` works for sync. Zero setup.
- **Production mode** (Supabase configured): real accounts, Postgres storage, per-user API keys.

## Run locally (dev mode)

```bash
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:3000
```

From `../cli`: `npm run dev -- sync --url http://localhost:3000 --key dev-key-123`

## Connect Supabase (do this once)

1. **Create the project** at [supabase.com](https://supabase.com) (free tier) — pick a region close to your users (EU West is a good default for a global audience).
2. **Run the schema:** Supabase dashboard → SQL Editor → New query → paste all of [src/lib/schema.sql](src/lib/schema.sql) → Run. Four tables + RLS lockdown.
3. **Get the keys:** Project Settings → API. Copy into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key — server-only, never expose>
   ```
4. **Auth URLs:** Authentication → URL Configuration → set Site URL to `http://localhost:3000` (later: your production domain) and add `http://localhost:3000/auth/callback` to Redirect URLs.
5. **Magic links work immediately** (Supabase's built-in email, fine for testing; add a custom SMTP sender before launch so emails come from your domain).
6. **GitHub OAuth (optional but recommended for a dev audience):** GitHub → Settings → Developer settings → New OAuth App. Homepage = your URL, callback = `https://<ref>.supabase.co/auth/v1/callback`. Paste client ID/secret into Supabase → Authentication → Providers → GitHub.
7. Restart `npm run dev` — the app flips to production mode on its own: `/dashboard` and `/settings` now require sign-in, API keys persist in Postgres.

## Structure

| Path | What |
|---|---|
| `src/app/page.tsx` | Landing page (terminal-receipt hero, pricing, FAQ) |
| `src/app/login/` | Magic link + GitHub sign-in |
| `src/app/(app)/dashboard/` | Spend overview — stats, charts, history, onboarding empty state |
| `src/app/(app)/settings/` | API keys (create/revoke, shown once), plan & billing |
| `src/app/auth/` | OAuth/magic-link callback + signout |
| `src/app/api/sync` | CLI upload — bearer key, strict validation, returns spend percentile |
| `src/app/api/checkout` | Creates a Kora hosted USD checkout and redirects |
| `src/app/api/webhooks/billing` | Kora webhooks → 31 days of access per charge (`paid_until`) |
| `src/app/api/cron/alerts` | Daily: budget alerts, 3×-average day alerts, renewal reminders, expiry |
| `src/app/api/cron/monthly-report` | Monthly: emails each opted-in user their finished month |
| `src/app/api/share` + `src/app/b/[slug]/` | Anonymous share cards with generated OG images |
| `src/app/cursor` + `src/app/api/waitlist` | Cursor adapter waitlist (email capture) |
| `src/lib/billing/` | `BillingProvider` interface + Kora impl |
| `src/lib/email.ts` | Resend HTTP API (logs instead of sending when unconfigured) |
| `src/lib/store.ts` | Store interface — Supabase Postgres or in-memory dev fallback |
| `src/lib/supabase/` | Server/admin clients |
| `src/middleware.ts` | Session refresh + route protection |

## Design system

IBM Plex Sans/Mono, ink background (#0a0c10), amber phosphor accent (#e8b45a). Tokens in `globals.css`. The identity: "the billing department of the terminal" — keep numbers in tabular mono, keep the amber for spend/action, green/red only for deltas.

## Before launch (remaining)

1. **Kora account** (individual business + KYC) — test keys in `.env.local`, sandbox-test checkout → webhook → access; confirm USD collection with Kora support (`KORA_CURRENCY`)
2. **Resend account** — `RESEND_API_KEY` + verified sending domain (`EMAIL_FROM`)
3. **Custom SMTP** in Supabase so auth emails come from your domain
4. **Deploy** (Vercel free tier; `vercel.json` schedules the two crons) + set `NEXT_PUBLIC_APP_URL`, Supabase auth URLs, and `CRON_SECRET`
5. **Team workspaces** — invite flow, roll-ups (or launch Solo-only with a Team waitlist)
