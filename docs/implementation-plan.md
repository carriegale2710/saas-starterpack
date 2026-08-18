# Implementation Plan — Lean Micro-SaaS Starter

**Status:** Planning only. No application code has been written. This document is the contract for what gets built in Phase 0 onward.

**Target user:** a solo founder shipping a subscription SaaS who wants a working billing loop and protected app shell in days, not weeks, and who will personally maintain the operational surface (no ops team, no on-call rotation).

---

## 1. Architecture Overview

A **single Next.js App Router application**, deployed as one Vercel project, structured as a **modular monolith**:

- One deployable unit. One repo. One build.
- Internal module boundaries (`lib/supabase`, `lib/stripe`, `lib/entitlements`, `modules/*`) are enforced by folder convention and import discipline, not by network calls, package boundaries, or separate services.
- All privileged operations (Supabase service-role queries, Stripe secret-key calls, webhook verification) run **only** in server-side code: Server Components, Server Actions, and Route Handlers. Nothing privileged ships to the client bundle.
- Postgres (via Supabase) is the single source of truth for application data. Stripe is the single source of truth for billing/subscription _state_; the local `subscriptions` table is a synced read-cache of that state, kept current exclusively through verified webhooks — the app never derives entitlement from a client-trusted redirect or from optimistic writes.
- No separate backend service, no message broker, no cache layer. At starter scale, Postgres + serverless functions are sufficient for correctness and low enough in operational cost that adding infrastructure now would be speculative.

This is deliberately a "boring" architecture: every request either renders a Server Component, runs a Server Action, or hits a Route Handler that talks to Supabase and/or Stripe directly. There is no queue, no ORM layer, no internal API gateway.

---

## 2. Proposed Directory Structure

```
.
├── app/
│   ├── (marketing)/                 # public, unauthenticated
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # landing page
│   │   └── pricing/page.tsx
│   ├── (auth)/                      # unauthenticated auth flows
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (app)/                       # authenticated, protected
│   │   ├── layout.tsx               # session check + redirect
│   │   ├── dashboard/page.tsx
│   │   └── settings/
│   │       ├── profile/page.tsx
│   │       └── billing/page.tsx
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── webhook/route.ts     # POST, Stripe signature verified
│   │   │   ├── checkout/route.ts    # POST, authenticated
│   │   │   └── portal/route.ts      # POST, authenticated
│   │   └── health/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                          # shadcn-generated primitives (owned code)
│   └── shared/                      # composed, app-specific components
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # browser client (anon key)
│   │   ├── server.ts                # server component / action client (user session)
│   │   └── admin.ts                 # service-role client — 'server-only', webhook use alone
│   ├── stripe/
│   │   ├── client.ts                # Stripe SDK singleton
│   │   ├── checkout.ts              # createCheckoutSession()
│   │   ├── portal.ts                # createPortalSession()
│   │   └── webhook-handlers.ts      # event-type → handler map
│   ├── entitlements/
│   │   ├── config.ts                # central product/plan configuration
│   │   └── get-entitlements.ts      # resolves a user's current plan/access
│   ├── env.ts                       # zod-validated environment, single import site
│   └── utils.ts                     # cn() and other small helpers
├── modules/                         # optional, opt-in, isolated (see §9)
│   ├── teams/
│   ├── usage-billing/
│   ├── storage/
│   ├── email/
│   ├── analytics/
│   ├── error-tracking/
│   ├── ai/
│   └── jobs/
├── supabase/
│   ├── migrations/
│   │   ├── 0001_profiles.sql
│   │   ├── 0002_customers.sql
│   │   ├── 0003_subscriptions.sql
│   │   ├── 0004_stripe_events.sql
│   │   └── 0005_rls_policies.sql
│   └── config.toml
├── middleware.ts                    # Supabase session refresh
├── tests/
│   ├── unit/
│   │   ├── entitlements.test.ts
│   │   ├── webhook-handlers.test.ts
│   │   └── env.test.ts
│   └── setup.ts
├── docs/
│   └── implementation-plan.md
├── .env.example
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

`modules/*` folders are scaffolded empty (or omitted entirely) at template creation time — see §9. Nothing in `app/`, `lib/`, or `supabase/migrations` should ever import from a `modules/*` folder in the core template; the dependency only ever points the other way.

---

## 3. Core Database Schema

`auth.users` is managed by Supabase Auth and is not modified directly. All app tables live in `public` and hang off `auth.users.id`.

| Table           | Columns                                                                                                                                                                                                                                                                          | Notes                                                                                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles`      | `id uuid PK references auth.users(id)`, `full_name text`, `avatar_url text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`                                                                                                                      | 1:1 with a user. Row created lazily on first authenticated request if missing.                                                                                                                                                                                                                         |
| `customers`     | `user_id uuid PK references auth.users(id)`, `stripe_customer_id text unique not null`, `created_at timestamptz default now()`                                                                                                                                                   | Maps a user to exactly one Stripe Customer. Populated lazily — see §4/§5 — never at signup. Written only by server code holding the service-role client, via an idempotent get-or-create so concurrent requests can't create two Stripe Customers for the same user (§7 discusses the resolver shape). |
| `subscriptions` | `id text PK` (Stripe subscription id), `user_id uuid references auth.users(id)`, `stripe_customer_id text`, `status text`, `price_id text`, `quantity int`, `cancel_at_period_end boolean`, `current_period_end timestamptz`, `created_at timestamptz`, `updated_at timestamptz` | Mirrors the Stripe Subscription object. Upserted by the webhook handler only. This table, not Stripe, is what the app reads on every request for entitlement checks — Stripe is source of truth for _correctness_, this table is source of truth for _read latency_.                                   |
| `stripe_events` | `id text PK` (Stripe event id), `type text`, `created_at timestamptz default now()`                                                                                                                                                                                              | Idempotency ledger. See §6.                                                                                                                                                                                                                                                                            |

No ORM, no schema-management DSL: schema lives as plain, numbered SQL migration files under `supabase/migrations`, applied via the Supabase CLI. Types are generated from the live schema (`supabase gen types typescript`) rather than hand-maintained or derived from an ORM model layer.

---

## 4. Authentication Flow

- Provider: Supabase Auth, **email + password only** in the initial UI (decision 3, §17). Supabase itself already supports OAuth and magic-link/OTP without a schema change — `auth.users` is provider-agnostic — so enabling them later is a Supabase dashboard config change plus new UI, not a redesign.
- **Extension point for additional providers:** all sign-in/sign-up UI renders through a single `components/shared/auth-form.tsx` (or equivalent) that takes a list of enabled methods; the initial template passes it exactly one (`password`). Adding `magic-link` or `oauth:google` later means extending that method list and adding the corresponding Supabase client call (`signInWithOtp` / `signInWithOAuth`) — no change to `middleware.ts`, the `(auth)` route structure, or any table. `README.md`/`CLAUDE.md` documents this extension point explicitly so it isn't rediscovered later by reading source.
- Session handling: `@supabase/ssr`, cookie-based, refreshed in `middleware.ts` on every request so Server Components always see a valid session without a client-side round trip. This mechanism is identical regardless of which sign-in method issued the session, which is what makes providers addable later without touching session/middleware code.
- Protected routes: the `(app)` route group's `layout.tsx` is a Server Component that calls `supabase.auth.getUser()`; on no session, it redirects to `/login` before rendering anything underneath. This is the only gate — there is no separate authorization middleware layer beyond it in the core template.
- Sign-up creates only the `auth.users` row (Supabase-managed). `profiles` is created lazily on first authenticated request if missing; `customers` is **not** created at signup at all — see §4/§5 and decision 2, §17.
- Logout clears the Supabase session cookie via a Server Action.
- Password reset uses Supabase's built-in recovery email flow; no custom email templates are required for the core template (Supabase's default transactional email covers this without adding Resend).

---

## 5. Stripe Billing Flow

Checkout and the Customer Portal are both **Stripe-hosted, redirect-based**. The app never renders Stripe Elements and never touches card data, so no client-side Stripe.js is needed in the core template — that removes an entire dependency and its CSP/PCI surface.

1. Authenticated user clicks "Subscribe" with a `priceId` that comes from `lib/entitlements/config.ts` (never a client-supplied arbitrary string).
2. `POST /api/stripe/checkout` validates the request body with Zod against the allow-list of known price IDs, then calls a single `getOrCreateStripeCustomer(userId)` resolver (see §7) which **lazily provisions the Stripe Customer on first use** — at Checkout or at Portal, whichever happens first for that user, never at signup (decision 2, §17) — then creates a Checkout Session (`mode: "subscription"`) and returns the redirect URL.
3. Client redirects to Stripe-hosted Checkout. Stripe handles payment collection entirely.
4. On success, Stripe redirects to `success_url` (e.g. `/settings/billing?checkout=success`). This page shows an optimistic "activating your subscription…" state — it does **not** grant access itself. It may poll a lightweight status endpoint for a few seconds for a snappier UI, but the underlying `subscriptions` row, and therefore real entitlement, is only ever written by the webhook (§6). This avoids trusting the redirect as proof of payment.
5. "Manage billing" in Settings calls `POST /api/stripe/portal`, which also goes through `getOrCreateStripeCustomer(userId)` first (a user who never checked out can still open the Portal to, e.g., see billing history — the Portal handles "no active subscription" gracefully), then creates a Billing Portal session for the resolved `stripe_customer_id` and redirects there for plan changes, payment-method updates, and cancellation. The app does not reimplement any of that UI.

---

## 6. Webhook and Idempotency Strategy

`app/api/stripe/webhook/route.ts`:

- Runs on the Node.js runtime (not Edge) because the Stripe SDK's signature verification needs Node's `crypto`.
- Reads the **raw** request body (`await req.text()`) — App Router Route Handlers give you the unparsed body natively, so no special body-parser config is required (unlike the old Pages Router).
- Verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET` before touching the payload at all. Invalid signature → 400, nothing processed.
- Idempotency, two layers:
  1. **Ledger check:** look up `event.id` in `stripe_events`. If present, return `200` immediately — already handled. Stripe retries on non-2xx responses and can also redeliver, so this must be cheap and first.
  2. **Natural idempotency of the writes:** every handler upserts on a stable primary key (`subscriptions.id` = Stripe subscription id, `customers.user_id`), so even a duplicate that slips past the ledger check is a no-op, not a corruption. The ledger is an optimization and an audit trail, not the only safety net.
- Handled event types, kept to the minimum that keeps `subscriptions` correct: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Each is a small, pure function in `webhook-handlers.ts` keyed by event type in a plain object map (not a plugin framework — see §16.2) so an optional module can register an additional handler for an event type without editing the core switch.
- Processing happens synchronously in the request — no queue. At this scale the work is one or two upserts; this is explicitly revisited if an optional module (e.g. sending an email on every subscription event) adds enough latency to risk the function timeout — see §13.
- After successful processing, insert the event id into `stripe_events`, then return `200`.

---

## 7. Entitlement Model

- `lib/entitlements/config.ts` is the **central product configuration**: a small, explicit object listing each plan (key, display name, Stripe price id, feature flags/limits). Price IDs are read from validated environment variables (`STRIPE_PRICE_*`, see §10) rather than hardcoded, so the _shape_ of the config is generic and reusable across products while the _values_ are wired per-deployment — this is what keeps the template product-agnostic (§16.1 discusses this tension explicitly).
- `lib/entitlements/get-entitlements.ts` is the single function the rest of the app calls. Given a **billing owner id**, it reads the matching row from `subscriptions` (RLS-scoped, using the request-authenticated Supabase client — no service role needed for a read of your own row), maps `status` + `price_id` against `config.ts`, and returns a plan tier plus feature flags:
  - `status in ('active', 'trialing')` → entitled at the plan mapped from `price_id`.
  - Anything else (`past_due`, `canceled`, `unpaid`, or no row) → free/no-access tier.
- This function is called from Server Components/Actions to gate UI and from Route Handlers to gate protected server logic. There is no separate "entitlements service" — it's a query plus a lookup table, deliberately kept that simple.

**Billing-owner indirection (decision 4, §17).** In the core template a billing owner is always a user, so "billing owner id" and "`auth.uid()`" are the same value everywhere. To avoid a schema rewrite the day a workspace/organization owner is introduced, that mapping is isolated behind one function rather than inlined at every call site:

```
lib/entitlements/billing-owner.ts
  getBillingOwnerId(userId: string): Promise<string>   // core: returns userId unchanged
```

- `getOrCreateStripeCustomer`, `getEntitlements`, and the checkout/portal Route Handlers all resolve the billing owner through this one function instead of assuming `auth.uid()` directly. `customers.user_id` and `subscriptions.user_id` are named generically enough (`user_id`, not e.g. `owner_user_id_not_org_id`) that a future Teams module can repoint `getBillingOwnerId` to return a workspace id and rename/repoint the FK — a schema and resolver change, but **not** a rewrite of `webhook-handlers.ts`, the Stripe API calls, or the idempotency ledger, all of which only ever operate on "the billing owner id," never on "the user id" as a hardcoded concept.
- This is intentionally a single indirection point, not a speculative "owner" abstraction layered through the whole codebase (§16.2) — everything else in core still reads and writes `user_id` columns directly and in plain SQL.

---

## 8. Security Model

- **Service-role isolation:** the Supabase service-role client (`lib/supabase/admin.ts`) is the only client that can bypass RLS. It is imported by the webhook route only, marked with the `server-only` package so any accidental client import fails the build rather than leaking the key at runtime.
- **RLS everywhere:** RLS is enabled on `profiles`, `customers`, `subscriptions`, `stripe_events` with default-deny and explicit policies:
  - `profiles`: user can `select`/`update` where `id = auth.uid()`.
  - `customers`, `subscriptions`, `stripe_events`: user can `select` their own row(s) only (`user_id = auth.uid()` where applicable; `stripe_events` has no user-facing read need and can simply have no client-facing policy at all). No client-side `insert`/`update`/`delete` policy exists on any of these three — all writes come from the service-role webhook path or the lazy-provisioning resolver by design.
- **Input validation:** Zod schemas at every external boundary — environment variables (§10), the checkout request body (price id allow-list), the profile update form, and the _shape_ expected from a verified Stripe event before it's passed to a handler. Signature verification proves authenticity; Zod validation still guards shape before the app trusts field values.
- **Secrets never reach the client:** only `NEXT_PUBLIC_*`-prefixed variables are readable in browser code; `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are never prefixed that way and are only referenced from files under `lib/*/admin.ts`, `lib/stripe/client.ts`, and the webhook route.
- **CSRF:** the checkout and portal Route Handlers require a valid Supabase session cookie (`SameSite=Lax` by default) and re-check the session server-side rather than trusting any client-supplied user id. The webhook route is intentionally exempt from session auth — it authenticates via Stripe's signature instead, which is the correct mechanism for a server-to-server callback.

---

## 9. Optional Module Boundaries

Each optional module lives in its own `modules/<name>` folder, is not imported anywhere in core unless explicitly wired in, and is added only when a concrete need shows up. None are scaffolded with real code in the initial template — folders may not even exist until the first module is added.

| Module                      | What it adds                                                                                                                      | Touches core how                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Teams/workspaces**        | `organizations`, `memberships` tables; RLS keyed by org membership                                                                | Still the largest blast radius of any optional module — moving `subscriptions`/`customers` from `user_id`-owned to org-owned is a real data migration of core tables, not a pure addition. §7's `getBillingOwnerId` indirection (decision 4, §17) narrows the _code_ change to that one resolver plus the webhook-handler call sites that use it, but does not remove the need to migrate existing `subscriptions.user_id` values to an owner id and rewrite the RLS policies on those tables. |
| **Usage-based billing**     | `usage_records` table, Stripe usage-record/metered-price calls                                                                    | Registers an extra handler in the webhook event map (`invoice.created`, etc.); does not change core tables.                                                                                                                                                                                                                                                                                                                                                                                    |
| **Supabase Storage**        | Buckets + storage RLS policies                                                                                                    | Additive only — new policies, no change to existing tables.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Resend (email)**          | Transactional email templates + send calls                                                                                        | Called from a hook point after webhook processing succeeds (fire-and-forget), never from inside the core handler itself.                                                                                                                                                                                                                                                                                                                                                                       |
| **PostHog (analytics)**     | Client + server tracking wrappers                                                                                                 | Additive script/provider; no schema or auth changes.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Sentry (error tracking)** | Instrumentation config, source maps                                                                                               | Additive; adds build-time complexity (source map upload) worth calling out under maintenance cost.                                                                                                                                                                                                                                                                                                                                                                                             |
| **AI integrations**         | Provider SDK, its own routes/env vars                                                                                             | Fully additive, isolated route handlers.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Background jobs**         | Vercel Cron for simple schedules, or a queue service (e.g. Inngest/Trigger.dev) only if genuine durable/async execution is needed | Not added speculatively — see §16.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

## 10. Environment Variables

Validated once, at import time, in `lib/env.ts` via a single Zod schema (`process.env` is parsed once; anything downstream imports the validated, typed object — never `process.env` directly). Build/boot fails loudly on a missing or malformed value rather than failing at request time.

| Variable                                                              | Exposure    | Purpose                                                                                            |
| --------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                            | public      | Supabase project URL                                                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                       | public      | Supabase anon key (RLS-scoped, safe client-side)                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`                                           | server-only | Bypasses RLS — webhook route only                                                                  |
| `STRIPE_SECRET_KEY`                                                   | server-only | Stripe server SDK                                                                                  |
| `STRIPE_WEBHOOK_SECRET`                                               | server-only | Verifies webhook signatures                                                                        |
| `STRIPE_PRICE_<PLAN>` (one per plan, e.g. `STRIPE_PRICE_PRO_MONTHLY`) | server-only | Feeds `lib/entitlements/config.ts`; differs between Stripe test/live mode and thus per environment |
| `NEXT_PUBLIC_SITE_URL`                                                | public      | Builds Checkout/Portal `success_url`/`cancel_url`/`return_url`                                     |

Deliberately **not** included: analytics keys, email provider keys, AI provider keys — those belong to their respective optional modules' own env schemas, so core `env.ts` doesn't grow with every module a founder might never enable.

---

## 11. Testing Strategy

Core template ships **two layers** (decision 1, §17):

**Vitest — unit and integration tests:**

- `env.test.ts` — the Zod schema rejects malformed/missing env and accepts a valid example.
- `entitlements.test.ts` — given fixture `subscriptions` rows (active/past_due/canceled/none), `getEntitlements` returns the expected tier for each.
- `webhook-handlers.test.ts` — each handler function, given a fixture Stripe event object and a mocked Supabase admin client, calls the expected upsert with the expected shape. This tests the pure logic, not real signature verification or a live webhook round-trip.
- `billing-owner.test.ts` — `getBillingOwnerId` returns the input user id unchanged in core (guards against silent behavior drift if it's touched later).
- `checkout-flow.test.ts` — an **integration** test (not E2E) that exercises `POST /api/stripe/checkout` end-to-end against a **mocked Stripe SDK client**: asserts `getOrCreateStripeCustomer` is called, that a second concurrent call for the same user does not create a second Stripe Customer (idempotency, decision 2), and that the Checkout Session is created with the validated price id. No real network call to Stripe is made.

**Playwright — browser tests for core navigation and auth only:**

- Sign up → land on dashboard.
- Log out → redirected away from protected routes.
- Attempt to visit `/dashboard` unauthenticated → redirected to `/login`.
- Password reset request flow renders the expected confirmation state.

Explicitly **not** in the core template: a Playwright test that drives a real Stripe-hosted Checkout page. Live Checkout is third-party UI outside the app's control, flaky to automate reliably, and requires live/test API keys in CI. Instead:

- The mocked `checkout-flow.test.ts` above covers the app's own logic.
- `README.md` documents an **optional manual verification procedure** for live Stripe: run `stripe listen --forward-to localhost:3000/api/stripe/webhook`, complete a real test-mode Checkout with Stripe's test card, and confirm the `subscriptions` row updates and the dashboard reflects the new entitlement. This is a documented runbook step, not an automated test — a founder runs it before major billing-code changes or before going live, not on every CI run.

---

## 12. Deployment Strategy

- **Vercel**, Git-connected: push to `main` deploys to production; PRs get preview deployments automatically. No custom CI pipeline is required for the deploy itself.
- **Environment variables** set per Vercel environment (Production/Preview/Development) in the dashboard, matching `.env.example`. Preview deployments will generally run against the same Supabase _project_ as local dev (or a dedicated dev project) and Stripe _test_ mode; production runs against Stripe live mode and a production Supabase project.
- **Stripe webhook endpoint:** registered once against the production URL (`https://<domain>/api/stripe/webhook`) using the live-mode signing secret. Preview deployments do not receive live webhooks; local development uses `stripe listen --forward-to localhost:3000/api/stripe/webhook` with the CLI's own signing secret. This is a known, accepted limitation for a solo founder rather than something the template tries to solve with per-branch webhook provisioning.
- **Database migrations:** applied **manually** (decision 5, §17) via the Supabase CLI against the target project. Not run automatically as part of the Vercel build, so a bad migration can't auto-apply to production on every deploy. `README.md`/deployment docs document the exact command sequence a founder runs:
  - `supabase migration list` — see which migrations exist locally vs. which have been applied to the linked remote project, before touching anything.
  - `supabase db reset` — local-only: rebuild the local dev database from all migrations plus seed data, for a clean slate while iterating.
  - `supabase db push --dry-run` — show exactly what would be applied to the linked remote project without applying it, so the founder reviews the diff first.
  - `supabase db push` — apply pending migrations to the linked remote project (staging or production, whichever is linked).
  - A **TODO** is recorded in the deployment docs: a future protected GitHub Actions workflow that runs `supabase db push` against production only on a manually-approved run (using a GitHub Environment with a required reviewer), so migrations stay out of the automatic merge-to-`main` path even once CI-applied. Not built now — see decision 5, §17.

---

## 13. Major Risks and Trade-offs

- **RLS misconfiguration is the single highest-severity risk** in this architecture — a wrong or missing policy silently exposes cross-user data. Mitigation: every policy is written explicitly in a migration file (no "just use the dashboard" policies), and the README includes an explicit pre-launch RLS checklist. Unit tests cannot verify RLS (they don't run against real Postgres); this is a known gap, not something Vitest can close.
- **Checkout-success vs. webhook-arrival race:** the user can land back on the app before the webhook fires. Mitigated with an explicit "activating…" UI state rather than granting access on redirect alone (§5), but it's a real UX rough edge on Stripe's side, not something the app fully controls.
- **Service-role key is a single powerful credential.** If leaked, it bypasses every RLS policy in the project. Mitigated with `server-only` import guards and by minimizing where it's referenced (webhook route only), but the residual risk is inherent to using a service-role key at all.
- **Synchronous webhook processing with no queue** is simple and fine at core scope (a couple of upserts), but if an optional module adds slow work inside the same request (e.g., a blocking email send), it risks approaching the function timeout. The mitigation is a convention, not a technical guardrail: optional-module hooks triggered from webhook handling must be fire-and-forget or explicitly deferred, never awaited inline.
- **Vendor lock-in to Supabase + Stripe + Vercel** is accepted deliberately in exchange for near-zero ops burden. Migrating off any one of them later is real work (Supabase: RLS + auth rewritten; Stripe: billing logic is deeply Stripe-shaped; Vercel: fairly portable since it's just Next.js). This is the central bet of "prefer managed services" and is worth being explicit about rather than pretending the template is vendor-neutral.
- **Test/live mode duplication:** two Stripe price ID sets, two webhook secrets, and (typically) two Supabase projects/environments is real solo-founder operational overhead. Mitigated with a clear `.env.example` and deployment docs, not eliminated.
- **No CI-enforced migration application** means schema and code can drift if the founder forgets to run a migration before/after deploying code that depends on it. `supabase migration list` and `db push --dry-run` (§12) reduce the chance of an accidental blind push, but the discipline is still manual. Accepted for now, with the CI-approval-gated workflow noted as a documented TODO rather than built (decision 5, §17) — revisit if drift causes an actual incident.
- **Lazy Stripe Customer provisioning introduces a first-use race** (decision 2, §17): two near-simultaneous requests (e.g. a user double-clicking "Subscribe," or a checkout and a portal-visit landing at once) could both see "no customer yet" and attempt to create one. `getOrCreateStripeCustomer` must therefore be genuinely idempotent, not just "check then insert" — implemented via a unique constraint on `customers.user_id` (already the primary key) and an upsert-on-conflict pattern: attempt the Stripe Customer creation, then insert with `on conflict (user_id) do nothing`, then re-read the row so a loser of the race still gets the winner's `stripe_customer_id` rather than orphaning a duplicate Stripe Customer. Worth flagging: this can still leak at most one orphaned-but-unused Stripe Customer object in the rare true-concurrent case (Stripe has no server-side "get or create" primitive), which is a Stripe-side cleanup cost, not a data-integrity one — the local `customers` table never has more than one row per user.

---

## 14. Explicit Non-Goals

The core template deliberately does **not** provide:

- Multi-tenant organizations, teams, or any role beyond "the account owner" (that's the Teams optional module, and it's a schema-changing addition, not a toggle).
- Usage-based/metered billing.
- An admin dashboard or internal ops UI.
- A public API for third-party consumption, or GraphQL.
- Internationalization/localization.
- A native mobile app or offline support.
- SSO/SAML or custom-built authentication beyond what Supabase Auth provides out of the box.
- Background job/queue infrastructure.
- Multi-region deployment or read replicas.
- Any product-specific business logic — features, copy, and domain rules belong to the app built _from_ this template, not to the template itself.

---

## 15. Phased Implementation Sequence

0. **Scaffolding** — Next.js + TS strict + Tailwind + shadcn init, ESLint/Prettier, `lib/env.ts` + `.env.example`, empty `README.md`/`CLAUDE.md`.
1. **Supabase wiring** — browser/server/admin clients, core migrations (`profiles`, `customers`, `subscriptions`, `stripe_events`), RLS policies, local dev via Supabase CLI, generated types.
2. **Auth** — signup/login/logout, `middleware.ts` session refresh, protected `(app)` route group, profile read/update page.
3. **Stripe core** — `lib/entitlements/config.ts`, checkout route, webhook route + idempotency ledger, portal route.
4. **Entitlements in the UI** — dashboard gates content by plan, billing settings page shows current plan + "Manage billing."
5. **Tests** — Vitest unit/integration tests for entitlements, webhook handlers, billing-owner resolver, and mocked checkout flow; Playwright tests for signup/login/logout/route-protection; live-Stripe manual verification runbook documented in `README.md`.
6. **Docs & deploy** — finalize `README.md` and `CLAUDE.md`, Vercel project + env vars, Stripe webhook registration, pre-launch RLS checklist.
7. **Optional modules**, added one at a time, only when a concrete product needs them, each following the boundary rules in §9.

---

## 16. Review Before Finishing

### 16.1 Contradictory or Tension-Bearing Requirements

None of the requirements are outright contradictory, but two pairs are in genuine tension and the design above resolves them explicitly rather than leaving them ambiguous:

- **"Central product configuration" vs. "keep product-specific business logic out of the template."** Resolved by making the config's _shape_ generic (plan key → price id → feature flags) while its _values_ come from environment variables filled in per deployment. The template ships the pattern, not a specific product's plans.
- **"Stripe webhooks as source of truth" vs. a founder's natural desire for instant post-checkout UI feedback.** Resolved by treating the redirect as a UI hint ("activating…") and the webhook-updated DB row as the only thing that ever grants entitlement — see §5 and the risk noted in §13. This is a UX cost accepted deliberately, not a bug to fix.

### 16.2 Unnecessary Complexity Rejected

- **No ORM (Prisma/Drizzle):** the Supabase JS client's query builder plus generated types from the live schema covers the CRUD this template needs. An ORM would add a second schema representation to keep in sync with the SQL migrations for no functional gain here.
- **No Redux or other global client-state library:** the app is server-component-heavy with small, local client state (forms, toggles). There's no cross-cutting client state that justifies a store.
- **No GraphQL:** there's exactly one client (this app). REST-shaped Route Handlers and Server Actions are simpler and sufficient.
- **No Redis:** webhook idempotency is handled with a Postgres unique-key ledger (§6); there's no caching or rate-limiting need yet that would justify a second managed data store.
- **No Docker for app development:** the Supabase CLI manages its own local Postgres; the Next.js app itself needs no containerization for local dev or for Vercel's build.
- **No microservices or separate backend:** Route Handlers in the same Next.js app are the backend. Splitting this out has no benefit at this scale and would reintroduce the operational overhead the brief explicitly asks to avoid.
- **No plugin/event-emitter framework for optional modules:** a plain object literal mapping Stripe event type → handler function is sufficient for modules to register extra behavior. A pub/sub abstraction would be solving a problem this template doesn't have yet.
- **No embedded Stripe Elements / client-side Stripe.js:** redirect-based Checkout and Portal cover subscription billing fully and remove an entire dependency plus PCI/CSP surface area; embeddable checkout is a legitimate future enhancement, not a core need.

### 16.3 Smallest Viable Core

Everything in §1–§8 (architecture, directories excluding `modules/*`, schema, auth, billing flow, webhook handling, entitlements, security) plus the test suite (§11) and deploy setup (§12) is the floor — removing any one of these breaks either "subscription SaaS" or "safe to run solo." Nothing in the mandatory feature list was found to be droppable. The places where the _scope within_ a mandatory feature was genuinely negotiable — testing depth, Stripe Customer provisioning timing, which auth methods ship in the UI, whether billing ownership gets an indirection point now, and how migrations get applied — were the five items surfaced as decisions rather than cut unilaterally; all five are now resolved in §17 and folded into §1–§12 above as the approved design.

---

## 17. Decisions Record

Five decisions were flagged in the previous revision of this plan as requiring approval rather than being made unilaterally. All five have now been decided and are recorded below, along with the trade-off each one accepts. §2–§16 above have been updated to reflect these as the approved design, not open questions.

### 1. Testing depth

**Decision:** Vitest for unit and integration tests (including a mocked Checkout-flow integration test, §11). Playwright for core navigation and authentication behavior only (signup, login, logout, route protection). No Playwright test drives a live Stripe Checkout page in the core template; a manual live-Stripe verification procedure is documented in `README.md` instead.

**Trade-off accepted:** this buys confidence in the app's own logic (auth gating, the checkout request's idempotency and validation) without taking on the flakiness and CI cost of automating a third-party hosted page, and without needing live/test Stripe keys sitting in CI. The cost is that a live Stripe-side integration break (e.g. Stripe changing Checkout's behavior, or a webhook misconfiguration in the actual Stripe dashboard) will not be caught automatically — it's caught the next time the manual runbook is run. This is judged acceptable because the manual procedure is cheap to run before major billing changes or a production release, and because full checkout-page automation was the single most expensive item to maintain relative to what it would have caught.

### 2. Stripe Customer provisioning timing

**Decision:** Lazy provisioning only. No Stripe Customer or `customers` row is created at signup. `getOrCreateStripeCustomer(userId)` is the single, idempotent resolver called by both the checkout and portal Route Handlers on first use, and it is safe under concurrent calls (§13 details the upsert-on-conflict mechanism).

**Trade-off accepted:** signup stays minimal — no DB trigger or edge function needs to call out to Stripe synchronously during account creation, which removes a failure mode from the signup path entirely (a Stripe API hiccup can no longer break signup). The cost is a small amount of latency the _first_ time a user hits Checkout or the Portal (one extra Stripe API call inline), and the idempotency handling described in §13 has to exist and be tested (`checkout-flow.test.ts`, §11) rather than being sidestepped by "it only ever happens once, at signup, single-threaded."

### 3. Authentication

**Decision:** Email/password only in the initial UI. The auth module is structured so magic-link and OAuth providers can be added later without touching the database schema or route structure — a single method-list extension point in the auth form component, documented in `README.md`/`CLAUDE.md` (§4 has the detail). No OAuth buttons or provider-specific configuration ship in core.

**Trade-off accepted:** the initial auth surface is as small as possible to build, test (Playwright, §11), and reason about, and adding a provider later is additive (new method in the list, new Supabase dashboard config) rather than a redesign — because Supabase Auth's `auth.users` and the session/middleware mechanism are already provider-agnostic, this cost was low to design for up front. The cost is that a founder who wants "Sign in with Google" on day one has to add it themselves following the documented extension point rather than toggling a flag; this was accepted because provider buttons are UI + dashboard config work specific to which providers a given product wants, which is product-specific decoration this template shouldn't guess at.

### 4. Teams and billing ownership

**Decision:** `subscriptions`, `customers`, and entitlements stay strictly user-scoped in the core template. No workspaces, teams, invitations, or organization-owned billing are implemented. Billing code is structured so a future workspace owner can replace the billing-owner lookup without rewriting Stripe webhook processing — via the single `getBillingOwnerId` resolver described in §7, which in core simply returns the user id unchanged.

**Trade-off accepted:** this keeps the core schema and RLS policies as simple as they can be (§3, §8) and defers all of the real complexity of Teams — membership tables, invitation flows, org-scoped RLS, and the actual data migration of existing `subscriptions.user_id` values to an owner id — to if and when it's genuinely needed, rather than building it speculatively. The one concession made now is the indirection point itself: every call site that currently means "the user" resolves through `getBillingOwnerId` instead of hardcoding `auth.uid()`, which is a small, cheap abstraction (one function, returns its input in core) that narrows a future Teams migration to that resolver plus the tables/policies, rather than a hunt through every Stripe call site in the codebase. This was judged worth the minor indirection cost precisely because the alternative — retrofitting it later — touches billing code, which is the highest-blast-radius code in the app to get wrong.

### 5. Migration application

**Decision:** Manual Supabase migration deployment for now. `README.md`/deployment docs specify the exact commands (`supabase migration list`, `supabase db reset` for local, `supabase db push --dry-run` then `supabase db push` for remote). No CI workflow applies production migrations yet. A TODO is recorded describing a future GitHub Actions workflow, gated behind a protected/approval-required GitHub Environment, that would run `supabase db push` against production only on explicit human approval.

**Trade-off accepted:** this avoids putting a database credential capable of altering production schema into CI before it's actually needed, and avoids building/maintaining a pipeline for a step a solo founder can run in one command. The cost is the drift risk noted in §13 — a founder can forget to push a migration before or after deploying dependent code — partially mitigated by making `migration list` and `--dry-run` part of the documented habit rather than optional. The future CI workflow is written down as a TODO with its exact intended safety property (explicit approval gate, not automatic-on-merge) so that when it is built, it's built to the same "no silent production writes" standard the rest of this plan holds to, rather than being added hastily later under time pressure.
