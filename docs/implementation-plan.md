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
│   │   ├── forgot-password/page.tsx # request recovery email
│   │   └── reset-password/page.tsx  # password-update form (callback target)
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
│   │   └── admin.ts                 # service-role client — 'server-only'; used by webhook route and billing repository
│   ├── stripe/
│   │   ├── client.ts                # Stripe SDK singleton
│   │   ├── checkout.ts              # createCheckoutSession()
│   │   ├── portal.ts                # createPortalSession()
│   │   └── webhook-handlers.ts      # event-type → handler map
│   ├── billing/
│   │   └── repository.ts            # server-only billing DB operations (getOrCreateStripeCustomer, upsertSubscription)
│   ├── entitlements/
│   │   ├── config.ts                # central product/plan configuration
│   │   ├── get-entitlements.ts      # resolves a user's current plan/access
│   │   └── billing-owner.ts         # getUserBillingOwnerId() — core returns userId unchanged
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
│   │   ├── webhook-idempotency.test.ts
│   │   ├── billing-owner.test.ts
│   │   └── env.test.ts
│   ├── integration/
│   │   └── checkout-flow.test.ts
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

| Table           | Columns                                                                                                                                                                                                                                                                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles`      | `id uuid PK references auth.users(id)`, `full_name text`, `avatar_url text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`                                                                                                                                                 | 1:1 with a user. Row created lazily on first authenticated request if missing. `updated_at` must be kept current; use a trigger (`moddatetime`) or explicit `SET updated_at = now()` on every update.                                                                                                                                                                                                                                            |
| `customers`     | `user_id uuid PK references auth.users(id)`, `stripe_customer_id text unique not null`, `created_at timestamptz default now()`                                                                                                                                                                              | Maps a user to exactly one Stripe Customer. Populated lazily — see §4/§5 — never at signup. Written only by server code via the billing repository (`lib/billing/repository.ts`), which holds the service-role client and performs an idempotent upsert-on-conflict — see §7 for the full concurrency model.                                                                                                                                     |
| `subscriptions` | `id text PK` (Stripe subscription id), `user_id uuid references auth.users(id)`, `stripe_customer_id text not null`, `status text not null`, `price_id text`, `quantity int`, `cancel_at_period_end boolean`, `current_period_end timestamptz`, `created_at timestamptz`, `updated_at timestamptz not null` | Mirrors the Stripe Subscription object. Upserted exclusively by the webhook handler. `updated_at` must be set on every upsert. Unknown `status` values (not in the handled set) must be stored as-is rather than silently discarded — the row still receives the raw `status` string; entitlement resolution in §7 treats any status outside `('active', 'trialing')` as the free tier. This table is what the app reads for entitlement checks. |
| `stripe_events` | `id text PK` (Stripe event id), `type text not null`, `status text not null default 'processing'`, `created_at timestamptz default now()`, `updated_at timestamptz not null`                                                                                                                                | Atomic idempotency ledger and processing-state tracker. See §6 for the full state machine (`processing` → `processed` / `failed`).                                                                                                                                                                                                                                                                                                               |

No ORM, no schema-management DSL: schema lives as plain, numbered SQL migration files under `supabase/migrations`, applied via the Supabase CLI. Types are generated from the live schema (`supabase gen types typescript`) rather than hand-maintained or derived from an ORM model layer.

---

## 4. Authentication Flow

- Provider: Supabase Auth, **email + password only** in the initial UI (decision 3, §17). Supabase itself already supports OAuth and magic-link/OTP without a schema change — `auth.users` is provider-agnostic — so enabling them later is a Supabase dashboard config change plus new UI, not a redesign.
- **Extension point for additional providers:** all sign-in/sign-up UI renders through a single `components/shared/auth-form.tsx` (or equivalent) that takes a list of enabled methods; the initial template passes it exactly one (`password`). Adding `magic-link` or `oauth:google` later means extending that method list and adding the corresponding Supabase client call (`signInWithOtp` / `signInWithOAuth`) — no change to `middleware.ts`, the `(auth)` route structure, or any table. `README.md`/`CLAUDE.md` documents this extension point explicitly so it isn't rediscovered later by reading source.
- Session handling: `@supabase/ssr`, cookie-based, refreshed in `middleware.ts` on every request so Server Components always see a valid session without a client-side round trip. This mechanism is identical regardless of which sign-in method issued the session, which is what makes providers addable later without touching session/middleware code.
- Protected routes: the `(app)` route group's `layout.tsx` is a Server Component that calls `supabase.auth.getUser()`; on no session, it redirects to `/login` before rendering anything underneath. This is the only gate — there is no separate authorization middleware layer beyond it in the core template.
- Sign-up creates only the `auth.users` row (Supabase-managed). `profiles` is created lazily on first authenticated request if missing; `customers` is **not** created at signup at all — see §5 and decision 2, §17.
- Logout clears the Supabase session cookie via a Server Action.

### Forgot Password / Recovery Flow

The forgot-password and password-recovery flows are part of the core auth surface and are implemented as follows:

1. **`/forgot-password` page** — unauthenticated. Renders a simple email-input form. On submit, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<SITE_URL>/reset-password' })`. Supabase sends a recovery email with a one-time link. The page always renders a generic confirmation message ("If an account exists for that email, a reset link has been sent") regardless of whether the address is registered, to avoid email enumeration.
2. **Recovery email link** — Supabase Auth generates a link containing a token (PKCE flow) pointing to `<SITE_URL>/reset-password`. The `(auth)/reset-password/page.tsx` page is the callback target for this link.
3. **`/reset-password` page** — unauthenticated (user arrives via the emailed link, not a session). Reads the Supabase `code` search param from the URL, exchanges it for a session via `supabase.auth.exchangeCodeForSession(code)`, then renders a password-update form. On submit, calls `supabase.auth.updateUser({ password: newPassword })`. On success, redirects to `/login` (or `/dashboard` if a session is now active). On error (expired/already-used token), renders an error state with a link back to `/forgot-password`.
4. **Middleware note:** `middleware.ts` must not redirect the `/reset-password` path to `/login` when no prior session exists — it is a valid unauthenticated callback target. The unauthenticated `(auth)` route group already handles this correctly by design.
5. **No custom email templates** are required for the core template; Supabase's default transactional email covers the recovery message. Resend-based custom templates are an optional module concern.

---

## 5. Stripe Billing Flow

Checkout and the Customer Portal are both **Stripe-hosted, redirect-based**. The app never renders Stripe Elements and never touches card data, so no client-side Stripe.js is needed in the core template — that removes an entire dependency and its CSP/PCI surface.

1. Authenticated user clicks "Subscribe" with a `priceId` that comes from `lib/entitlements/config.ts` (never a client-supplied arbitrary string).
2. `POST /api/stripe/checkout` validates the request body with Zod against the allow-list of known price IDs, then calls `getOrCreateStripeCustomer(userId)` (see §7), which **lazily provisions the Stripe Customer on first use** — at Checkout or at Portal, whichever happens first for that user, never at signup (decision 2, §17). It then creates a Checkout Session (`mode: "subscription"`) with the `stripe_customer_id` set and `client_reference_id` set to the app `userId` for ownership resolution in webhooks (see §6.1). Returns the Stripe-hosted redirect URL.
3. Client redirects to Stripe-hosted Checkout. Stripe handles payment collection entirely.
4. On success, Stripe redirects to `success_url` (e.g. `/settings/billing?checkout=success`). This page shows an optimistic "activating your subscription…" state — it does **not** grant access itself. It may poll a lightweight status endpoint for a few seconds for a snappier UI, but the underlying `subscriptions` row, and therefore real entitlement, is only ever written by the webhook (§6). This avoids trusting the redirect as proof of payment.
5. "Manage billing" in Settings calls `POST /api/stripe/portal`, which also goes through `getOrCreateStripeCustomer(userId)` first (a user who never checked out can still open the Portal to see billing history), then creates a Billing Portal session and redirects. The app does not reimplement any of that UI.

Both `/api/stripe/checkout` and `/api/stripe/portal` require an authenticated session. Unauthenticated requests receive a `401` before any Stripe call is made.

---

## 6. Webhook and Idempotency Strategy

`app/api/stripe/webhook/route.ts`:

- Runs on the Node.js runtime (not Edge) because the Stripe SDK's signature verification needs Node's `crypto`.
- Reads the **raw** request body (`await req.text()`) — App Router Route Handlers give you the unparsed body natively, so no special body-parser config is required.

### 6.1 Stripe Metadata and Ownership Resolution

Stripe objects must carry enough metadata to allow the webhook handler to resolve ownership without trusting mutable Stripe state alone:

| Object               | Required metadata / fields                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Checkout Session** | `client_reference_id` set to the app `userId` at session creation. Used by `checkout.session.completed` to link the resulting Subscription to a user when the `customers` row does not yet exist. |
| **Customer**         | `metadata.userId` set to the app `userId` when the Stripe Customer is created via `getOrCreateStripeCustomer`. Allows recovery if the `customers` row is ever missing.                            |
| **Subscription**     | Inherits the Customer; no extra metadata required. The handler resolves `user_id` by looking up `customers.stripe_customer_id`.                                                                   |

The canonical ownership-resolution order in a webhook handler is:

1. Prefer the local `customers` table lookup by `stripe_customer_id` (fast, no Stripe API call).
2. Fall back to `checkout.session.client_reference_id` (available only on `checkout.session.completed`).
3. Last resort: retrieve the Stripe Customer object and read `metadata.userId` (one Stripe API call; only if the above two fail).

### 6.2 Webhook Processing State Machine

The `stripe_events` table implements a **processing-state ledger** rather than a simple presence check. The atomic claim prevents duplicate concurrent processing; the state column enables safe retries after failure.

**States:**

| Status       | Meaning                                                            |
| ------------ | ------------------------------------------------------------------ |
| `processing` | Event has been claimed; a handler is (or was) actively running.    |
| `processed`  | Handler completed successfully; event must not be re-processed.    |
| `failed`     | Handler threw an unrecoverable error; safe to retry (Stripe will). |

**Processing flow — strict ordering:**

1. **Verify the signature first.** Call `stripe.webhooks.constructEvent(rawBody, signature, secret)`. If verification fails → `400`, stop. Nothing else runs before this.
2. **Atomically claim the event.** Execute a single `INSERT INTO stripe_events (id, type, status, created_at, updated_at) VALUES ($1, $2, 'processing', now(), now()) ON CONFLICT (id) DO NOTHING` via the service-role client. Check the row count of the result:
   - **0 rows inserted** → a row already exists. Read its `status`:
     - `processed` → `200` immediately (already handled).
     - `processing` → another handler is live; return `200` to stop Stripe retrying right now (the in-flight handler will complete or mark it `failed`).
     - `failed` → the previous attempt errored; fall through and re-process (safe retry path).
   - **1 row inserted** → this handler owns the event; proceed.
3. **Run the appropriate handler.** Dispatch to the handler map in `webhook-handlers.ts`. If no handler is registered for the event type, mark the event `processed` and return `200` (unknown types are silently acknowledged — see §11 for the test covering this).
4. **On handler success:** update `stripe_events SET status = 'processed', updated_at = now() WHERE id = $1`, then return `200`.
5. **On handler error:** update `stripe_events SET status = 'failed', updated_at = now() WHERE id = $1`, then return `500`. Stripe will retry according to its retry schedule; the retry will enter the `failed` re-process path in step 2.

**This design deliberately avoids a read-then-insert pattern.** A read followed by a conditional insert is not atomic and creates a TOCTOU window where two concurrent requests both see "no row" and both proceed. The `INSERT … ON CONFLICT DO NOTHING` + row-count check is atomic at the Postgres level and is the correct primitive here.

### 6.3 Handled Event Types

The following events are handled. These are the minimum set needed to keep `subscriptions` correct and entitlement accurate:

| Event type                      | Effect on local state                                                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed`    | Ensure `customers` row exists (upsert); upsert `subscriptions` row from the session's subscription data.                                                                                      |
| `customer.subscription.created` | Upsert `subscriptions` row.                                                                                                                                                                   |
| `customer.subscription.updated` | Upsert `subscriptions` row (status, price, period end, cancel flag).                                                                                                                          |
| `customer.subscription.deleted` | Upsert `subscriptions` row with `status = 'canceled'`.                                                                                                                                        |
| `invoice.paid`                  | Update `subscriptions.current_period_end` and confirm `status = 'active'`; ensures recurring renewals keep the entitlement window current even when no `customer.subscription.updated` fires. |
| `invoice.payment_failed`        | Update `subscriptions.status` to `'past_due'`; revokes access at the next entitlement read.                                                                                                   |

**Entitlement-controlling events** are those that write to `subscriptions.status` or `subscriptions.current_period_end`. The combination of `customer.subscription.*` events (lifecycle) plus `invoice.paid` (renewal confirmation) plus `invoice.payment_failed` (delinquency) is the complete set. No other event type changes entitlement in the core template.

Unknown event types (not in the map above) are claimed, immediately marked `processed`, and return `200` — they are acknowledged to stop Stripe retrying, and the stored row serves as a debug audit trail.

### 6.4 Failure and Retry Semantics

- The webhook route returns `2xx` **only** after the event has been fully processed and the `stripe_events` row is marked `processed`.
- A `500` response signals processing failure. Stripe retries failed webhooks with exponential backoff (up to 72 hours). Each retry re-enters the state machine at step 2 above. Because the state is `failed`, it is treated as a fresh attempt rather than a duplicate.
- The `processing` state protects against in-flight duplication (two concurrent Stripe deliveries of the same event), not against retries after failure. A webhook that returns `500` will always be retried cleanly.
- At-least-once delivery means idempotent handler logic is still required. Every handler upserts on a stable primary key (`subscriptions.id` = Stripe subscription id), so a duplicate that is re-processed (e.g. a concurrent delivery where both see `failed`) is a no-op, not a corruption.
- **No queue.** Processing is synchronous in the request. At core scope the work is one or two upserts and a ledger update; this is explicitly revisited if an optional module adds enough latency to risk the function timeout (see §13).

---

## 7. Entitlement Model

- `lib/entitlements/config.ts` is the **central product configuration**: a small, explicit object listing each plan (key, display name, Stripe price id, feature flags/limits). Price IDs are read from validated environment variables (`STRIPE_PRICE_*`, see §10) rather than hardcoded, so the _shape_ of the config is generic and reusable across products while the _values_ are wired per-deployment.
- `lib/entitlements/get-entitlements.ts` is the single function the rest of the app calls. Given a **billing owner id**, it reads the matching row from `subscriptions` (RLS-scoped, using the request-authenticated Supabase client — no service role needed for a read of your own row), maps `status` + `price_id` against `config.ts`, and returns a plan tier plus feature flags:
  - `status in ('active', 'trialing')` → entitled at the plan mapped from `price_id`.
  - Anything else (`past_due`, `canceled`, `unpaid`, or no row, or any unknown status) → free/no-access tier.
- This function is called from Server Components/Actions to gate UI and from Route Handlers to gate protected server logic. There is no separate "entitlements service" — it's a query plus a lookup table.

### Billing-Owner Abstraction

**In the core template, a billing owner is always a user.** The function `getUserBillingOwnerId(userId)` in `lib/entitlements/billing-owner.ts` returns `userId` unchanged. `getOrCreateStripeCustomer`, `getEntitlements`, and the checkout/portal Route Handlers all resolve the billing owner through this one function.

```
lib/entitlements/billing-owner.ts
  getUserBillingOwnerId(userId: string): Promise<string>   // core: returns userId unchanged
```

**Important constraints and future-org warning:**

- `customers.user_id` and `subscriptions.user_id` currently hold the Supabase `auth.users.id` value directly. They are named generically, but they are foreign-keyed to `auth.users(id)`.
- **Future organization billing is not a free swap.** If a future Teams module needs billing owned by an organization rather than a user, the following are all required: (a) a schema migration to drop or replace the `auth.users` foreign keys on `customers` and `subscriptions` (or add a parallel org-scoped table); (b) a full RLS policy rewrite, since the current policies use `auth.uid()` directly; (c) a data migration for any existing rows. Returning a workspace/org ID from `getUserBillingOwnerId` will **not** work with the current schema — the FK constraint will reject it. `README.md`/`CLAUDE.md` must document this explicitly so a future developer does not assume the indirection point alone is sufficient.
- The indirection point narrows the _code-search blast radius_ to that one resolver plus its call sites. It does not eliminate the need for a real schema and RLS migration when org billing is introduced.
- Everything else in core still reads and writes `user_id` columns directly and in plain SQL.

### Lazy Stripe Customer Provisioning (`getOrCreateStripeCustomer`)

Lives in `lib/billing/repository.ts`, which imports the service-role client and is marked `server-only`. The algorithm:

1. Read `customers` for `user_id`. If a row exists, return `stripe_customer_id` immediately.
2. Create a Stripe Customer via the Stripe API with `metadata: { userId }`.
3. `INSERT INTO customers (user_id, stripe_customer_id) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`.
4. Re-read the row and return `stripe_customer_id` (handles the loser of a concurrent race — it gets the winner's customer id).

**Concurrency note:** this provides _local_ idempotency via the unique constraint on `customers.user_id`. In the rare true-concurrent case where two requests both complete step 1 with no row found, both reach step 2, and both call the Stripe API, **at most one orphaned unused Stripe Customer object** will be created in Stripe. This is a Stripe-side cleanup cost, not a data-integrity issue — the local `customers` table will never contain more than one row per user. This is **not** strict external API idempotency (no distributed lock prevents two Stripe API calls); it is local uniqueness enforced by the database constraint. Acceptable at this scale; noted as a known edge case.

---

## 8. Security Model

- **Service-role client scope:** `lib/supabase/admin.ts` creates a Supabase client with the service-role key. It is the only client that bypasses RLS. It is marked with the `server-only` package so any accidental import into a Client Component or browser bundle fails the build. **It is consumed by two places in core:**
  1. The webhook route (`app/api/stripe/webhook/route.ts`) — to perform the atomic event claim and upsert subscriptions/customers without RLS interference.
  2. `lib/billing/repository.ts` — the narrowly scoped, server-only billing repository used for lazy Stripe Customer provisioning (`getOrCreateStripeCustomer`).
     No other file in core should import from `lib/supabase/admin.ts`. It must never appear in `lib/supabase/client.ts`, any component, or any path reachable from the client bundle.
- **RLS everywhere:** RLS is enabled on `profiles`, `customers`, `subscriptions`, `stripe_events` with default-deny and explicit policies:
  - `profiles`: user can `select`/`update` where `id = auth.uid()`.
  - `customers`, `subscriptions`: user can `select` their own row(s) only (`user_id = auth.uid()`). No client-side `insert`/`update`/`delete` policy exists — all writes come from the service-role path by design.
  - `stripe_events`: no client-facing policy at all; no user-facing read need exists.
- **Input validation:** Zod schemas at every external boundary — environment variables (§10), the checkout request body (price id allow-list), the profile update form, and the _shape_ expected from a verified Stripe event before it's passed to a handler. Signature verification proves authenticity; Zod validation still guards shape.
- **Secrets never reach the client:** only `NEXT_PUBLIC_*`-prefixed variables are readable in browser code; `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are never prefixed that way and are only referenced from `lib/supabase/admin.ts`, `lib/billing/repository.ts`, `lib/stripe/client.ts`, and the webhook route.
- **CSRF:** checkout and portal Route Handlers require a valid Supabase session cookie (`SameSite=Lax` by default) and re-verify the session server-side. Unauthenticated requests to `/api/stripe/checkout` and `/api/stripe/portal` are rejected with `401`. The webhook route is intentionally exempt from session auth — it authenticates via Stripe's HMAC signature instead.

---

## 9. Optional Module Boundaries

Each optional module lives in its own `modules/<name>` folder, is not imported anywhere in core unless explicitly wired in, and is added only when a concrete need shows up.

| Module                      | What it adds                                                                                                                      | Touches core how                                                                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Teams/workspaces**        | `organizations`, `memberships` tables; RLS keyed by org membership                                                                | Largest blast radius of any module — requires a schema migration (drop/replace FK on `customers`/`subscriptions`), a full RLS policy rewrite, and a data migration. `getUserBillingOwnerId` is the code indirection point but does **not** eliminate the migration need (see §7). |
| **Usage-based billing**     | `usage_records` table, Stripe usage-record/metered-price calls                                                                    | Registers extra handlers in the webhook event map; does not change core tables.                                                                                                                                                                                                   |
| **Supabase Storage**        | Buckets + storage RLS policies                                                                                                    | Additive only — new policies, no change to existing tables.                                                                                                                                                                                                                       |
| **Resend (email)**          | Transactional email templates + send calls                                                                                        | Called from a hook point after webhook processing succeeds (fire-and-forget), never from inside the core handler itself.                                                                                                                                                          |
| **PostHog (analytics)**     | Client + server tracking wrappers                                                                                                 | Additive script/provider; no schema or auth changes.                                                                                                                                                                                                                              |
| **Sentry (error tracking)** | Instrumentation config, source maps                                                                                               | Additive; adds build-time complexity (source map upload).                                                                                                                                                                                                                         |
| **AI integrations**         | Provider SDK, its own routes/env vars                                                                                             | Fully additive, isolated route handlers.                                                                                                                                                                                                                                          |
| **Background jobs**         | Vercel Cron for simple schedules, or a queue service (e.g. Inngest/Trigger.dev) only if genuine durable/async execution is needed | Not added speculatively — see §16.2.                                                                                                                                                                                                                                              |

---

## 10. Environment Variables

Validated once, at import time, in `lib/env.ts` via a single Zod schema. Build/boot fails loudly on a missing or malformed value rather than failing at request time.

| Variable                                                              | Exposure    | Purpose                                                                                            |
| --------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                            | public      | Supabase project URL                                                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                       | public      | Supabase anon key (RLS-scoped, safe client-side)                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`                                           | server-only | Bypasses RLS — webhook route and billing repository only                                           |
| `STRIPE_SECRET_KEY`                                                   | server-only | Stripe server SDK                                                                                  |
| `STRIPE_WEBHOOK_SECRET`                                               | server-only | Verifies webhook signatures                                                                        |
| `STRIPE_PRICE_<PLAN>` (one per plan, e.g. `STRIPE_PRICE_PRO_MONTHLY`) | server-only | Feeds `lib/entitlements/config.ts`; differs between Stripe test/live mode and thus per environment |
| `NEXT_PUBLIC_SITE_URL`                                                | public      | Builds Checkout/Portal `success_url`/`cancel_url`/`return_url`                                     |

---

## 11. Testing Strategy

Core template ships **two layers** (decision 1, §17):

### Vitest — unit and integration tests

- `env.test.ts` — Zod schema rejects malformed/missing env and accepts a valid example.
- `entitlements.test.ts` — given fixture `subscriptions` rows (active/trialing/past_due/canceled/none/unknown status), `getEntitlements` returns the expected tier. Unknown status values must fall through to the free tier, not throw.
- `webhook-handlers.test.ts` — each handler function, given a fixture Stripe event object and a mocked service-role Supabase client, calls the expected upsert with the expected shape. Tests cover:
  - `checkout.session.completed` — ensures both `customers` upsert and `subscriptions` upsert are called.
  - `customer.subscription.created/updated/deleted` — verifies correct field mapping including `updated_at`.
  - `invoice.paid` — confirms `current_period_end` is updated and `status` is set/confirmed active.
  - `invoice.payment_failed` — confirms `status` is set to `past_due`.
  - **Unknown event type** — handler returns without error; event is marked `processed`.
  - **Unknown subscription status** — the raw status string is stored; entitlement resolves to free tier.
- `webhook-idempotency.test.ts` — tests for the state-machine logic in §6.2:
  - A `processing` event → `200` without re-running the handler.
  - A `processed` event → `200` without re-running the handler.
  - A `failed` event → handler is re-executed (safe retry path).
  - **Concurrent duplicate events** — two simultaneous claims for the same event id; only one proceeds, the other returns `200` (simulate via two calls with mocked DB returning 0 rows on the second insert).
  - Handler error → `stripe_events` row is marked `failed` and `500` is returned.
- `billing-owner.test.ts` — `getUserBillingOwnerId` returns the input user id unchanged in core.
- `checkout-flow.test.ts` (integration) — exercises `POST /api/stripe/checkout` against a mocked Stripe SDK:
  - `getOrCreateStripeCustomer` is called with the authenticated user id.
  - A second concurrent call for the same user does not create a second Stripe Customer (mocked DB returns conflict on second insert).
  - Checkout Session is created with the validated price id and correct `client_reference_id`.
  - **Unauthenticated request** → `401` before any Stripe call.
  - **Invalid price id** (not in allow-list) → `400`.
- `portal-flow.test.ts` (integration):
  - **Unauthenticated request** → `401`.
  - **Cross-user billing access** — a request authenticated as user A cannot access or create a portal session for user B's customer id (the route derives the customer id from the session user, not from request body).
- `password-recovery.test.ts` — `resetPasswordForEmail` is called with the correct `redirectTo` URL; the reset-password page exchanges the code and calls `updateUser`; expired/invalid token path renders an error state.

### Playwright — browser tests for core navigation and auth

- Sign up → land on dashboard.
- Log out → redirected away from protected routes.
- Attempt to visit `/dashboard` unauthenticated → redirected to `/login`.
- Forgot-password form submits and renders the generic confirmation message.
- `/reset-password` with a valid Supabase code param → password-update form renders.
- `/reset-password` with no code param / invalid code → error state renders.

**RLS behavior tests (local Supabase):**

Where practical (i.e. when `supabase start` is available in the CI environment), a small suite of SQL-level tests or server-integration tests verifies RLS policies directly against a local Supabase instance:

- A user cannot `SELECT` another user's `customers` or `subscriptions` row via the anon/user-scoped client.
- A user cannot `INSERT` or `UPDATE` `subscriptions` via the anon/user-scoped client.
- Service-role client can read and write all rows.
  These are noted as "run locally with `supabase start`" if the CI environment cannot provide a full Postgres instance; they are not blocked on CI availability.

**Not** in the core template: a Playwright test that drives a live Stripe-hosted Checkout page. Live Checkout is third-party UI, flaky to automate, and requires live/test API keys in CI. `README.md` documents a **manual live-Stripe verification runbook**: run `stripe listen --forward-to localhost:3000/api/stripe/webhook`, complete a test-mode Checkout with Stripe's test card, confirm the `subscriptions` row updates and the dashboard reflects the new entitlement.

---

## 12. Deployment Strategy

- **Vercel**, Git-connected: push to `main` deploys to production; PRs get preview deployments automatically. No custom CI pipeline required for the deploy itself.
- **Environment variables** set per Vercel environment (Production/Preview/Development) in the dashboard, matching `.env.example`. Preview deployments run against the same Supabase _project_ as local dev (or a dedicated dev project) and Stripe _test_ mode; production runs against Stripe live mode and a production Supabase project.
- **Stripe webhook endpoint:** registered once against the production URL using the live-mode signing secret. Preview deployments do not receive live webhooks; local development uses `stripe listen --forward-to localhost:3000/api/stripe/webhook` with the CLI's own signing secret.
- **Database migrations — manual deployment procedure:**

  > ⚠️ **`supabase db reset` is destructive.** It drops and recreates the entire local database from scratch. Never run it against a linked remote project — only against the local dev database. There is no undo.

  Applied **manually** (decision 5, §17) via the Supabase CLI. The exact command sequence:
  1. `supabase migration list` — compare local vs. applied-to-remote state before touching anything.
  2. `supabase db reset` — **local only**: rebuild the local dev database from all migrations plus seed. Drops all local data.
  3. `supabase db push --dry-run` — preview what would be applied to the linked remote project without applying it. Review the diff carefully.
  4. `supabase db push` — apply pending migrations to the linked remote (staging or production, whichever is linked).

  **Ordering discipline:** migrations must be applied to the remote _before_ deploying application code that depends on them. A code deploy that references a schema column added in a migration that hasn't been pushed yet will fail at runtime. The safe order is always: push migrations → verify with `migration list` → deploy code.

  A **TODO** is recorded: a future protected GitHub Actions workflow that runs `supabase db push` against production only on a manually-approved run (using a GitHub Environment with a required reviewer), so migrations stay out of the automatic merge-to-`main` path. Not built now — see decision 5, §17.

---

## 13. Major Risks and Trade-offs

- **RLS misconfiguration is the single highest-severity risk** — a wrong or missing policy silently exposes cross-user data. Mitigation: every policy is written explicitly in a migration file, and `README.md` includes an explicit pre-launch RLS checklist. Unit tests cannot verify RLS (they don't run against real Postgres); this is a known gap, partially addressed by the local Supabase RLS tests in §11.
- **Checkout-success vs. webhook-arrival race:** the user lands back on the app before the webhook fires. Mitigated with an explicit "activating…" UI state rather than granting access on redirect alone (§5). This is an inherent Stripe timing issue, not something the app fully controls.
- **Service-role key is a single powerful credential.** If leaked, it bypasses every RLS policy. Mitigated with `server-only` import guards and by confining usage to the webhook route and the billing repository only. The residual risk is inherent to using a service-role key at all.
- **Synchronous webhook processing with no queue** is fine at core scope (a couple of upserts). Optional-module hooks triggered from webhook handling must be fire-and-forget or explicitly deferred, never awaited inline.
- **Vendor lock-in to Supabase + Stripe + Vercel** is accepted deliberately in exchange for near-zero ops burden.
- **Test/live mode duplication:** two Stripe price ID sets, two webhook secrets, and typically two Supabase projects — real solo-founder operational overhead, mitigated with a clear `.env.example`.
- **No CI-enforced migration application** — schema and code can drift if the founder forgets to run migrations in order. `supabase migration list` and `--dry-run` reduce the risk. The migration-ordering discipline in §12 is the primary mitigation.
- **Lazy Stripe Customer provisioning race:** two near-simultaneous requests can both see "no customer yet" and both call the Stripe API, creating at most one orphaned unused Stripe Customer in Stripe. This is not a data-integrity issue (the local `customers` table never has more than one row per user), but it is a Stripe-side cleanup cost. There is no distributed lock; this is accepted at this scale — see §7.
- **Future org billing is a real migration, not a config toggle.** `getUserBillingOwnerId` narrows the code blast radius but does not substitute for a schema and RLS migration. See §7 for the full warning.

---

## 14. Explicit Non-Goals

The core template deliberately does **not** provide:

- Multi-tenant organizations, teams, or any role beyond "the account owner."
- Usage-based/metered billing.
- An admin dashboard or internal ops UI.
- A public API for third-party consumption, or GraphQL.
- Internationalization/localization.
- A native mobile app or offline support.
- SSO/SAML or custom-built authentication beyond what Supabase Auth provides.
- Background job/queue infrastructure.
- Multi-region deployment or read replicas.
- Any product-specific business logic.

---

## 15. Phased Implementation Sequence

0. **Scaffolding** — Next.js + TS strict + Tailwind + shadcn init, ESLint/Prettier, `lib/env.ts` + `.env.example`, empty `README.md`/`CLAUDE.md`.
1. **Supabase wiring** — browser/server/admin clients, core migrations (`profiles`, `customers`, `subscriptions`, `stripe_events`), RLS policies, local dev via Supabase CLI, generated types. Confirm `stripe_events` includes `status` and `updated_at` columns per §3.
2. **Auth** — signup/login/logout, `middleware.ts` session refresh (ensure `/reset-password` is not blocked), protected `(app)` route group, profile read/update page, forgot-password flow and password-recovery callback (§4).
3. **Stripe core** — `lib/entitlements/config.ts`, `lib/billing/repository.ts` (service-role, `getOrCreateStripeCustomer` with metadata), checkout route with `client_reference_id` and `metadata`, portal route, webhook route with atomic event claim and full state machine (§6), webhook handlers including `invoice.paid`.
4. **Entitlements in the UI** — dashboard gates content by plan, billing settings page shows current plan + "Manage billing." `getEntitlements` must handle unknown status values gracefully.
5. **Tests** — Vitest unit/integration tests per §11 (entitlements, webhook handlers, idempotency state machine, `invoice.paid`, concurrent duplicate events, unknown event types, unknown subscription statuses, unauthenticated checkout/portal, cross-user billing access, password recovery); Playwright tests (signup/login/logout/route-protection, forgot-password, reset-password); local Supabase RLS tests where practical; live-Stripe manual verification runbook in `README.md`.
6. **Docs & deploy** — finalize `README.md` and `CLAUDE.md` (document `getUserBillingOwnerId` extension point and org-billing migration warning, document `supabase db reset` destructiveness and migration ordering, document service-role client consumers), Vercel project + env vars, Stripe webhook registration, pre-launch RLS checklist.
7. **Optional modules**, added one at a time, only when a concrete product needs them.

### Smallest Viable Core

Everything in §1–§8 (architecture, directories excluding `modules/*`, schema, auth including password recovery, billing flow, webhook handling with state machine, entitlements, security) plus the test suite (§11) and deploy setup (§12) is the floor — removing any one of these breaks either "subscription SaaS" or "safe to run solo." The five decisions in §17 resolve the genuinely negotiable scope items within the mandatory features.

---

## 16. Review Before Finishing

### 16.1 Contradictory or Tension-Bearing Requirements

- **"Central product configuration" vs. "keep product-specific business logic out of the template."** Resolved by making the config's _shape_ generic while its _values_ come from environment variables per deployment.
- **"Stripe webhooks as source of truth" vs. instant post-checkout UI feedback.** Resolved by treating the redirect as a UI hint and the webhook-updated DB row as the only thing that grants entitlement (§5, §13).
- **"Billing-owner indirection" vs. "current schema uses auth.users FK."** Resolved by documenting the indirection as a code blast-radius narrower only, not a schema substitute; org billing requires a real migration (§7, §9, §13).

### 16.2 Unnecessary Complexity Rejected

- No ORM (Prisma/Drizzle).
- No Redux or other global client-state library.
- No GraphQL.
- No Redis — webhook idempotency is handled with Postgres atomic insert.
- No Docker for app development.
- No microservices or separate backend.
- No plugin/event-emitter framework for optional modules.
- No embedded Stripe Elements / client-side Stripe.js.

### 16.3 Smallest Viable Core

See §15. Nothing in §1–§8 was found to be droppable. The five items negotiated as decisions (testing depth, provisioning timing, auth methods, billing ownership abstraction, migration application) are resolved in §17 and reflected in §1–§15.

---

## 17. Decisions Record

### 1. Testing depth

**Decision:** Vitest for unit and integration tests (including mocked checkout-flow and portal-flow integration tests, idempotency state-machine tests, and `invoice.paid` and failure/retry tests per §11). Playwright for core navigation and authentication behavior including forgot-password and password-recovery flows. No Playwright test drives a live Stripe Checkout page in the core template; a manual live-Stripe verification runbook is documented in `README.md` instead.

**Trade-off accepted:** buys confidence in the app's own logic without live Stripe keys in CI. A live Stripe-side integration break will not be caught automatically — caught when the manual runbook is run. Judged acceptable for a solo founder running the procedure before major billing changes or a production release.

### 2. Stripe Customer provisioning timing

**Decision:** Lazy provisioning only. `getOrCreateStripeCustomer(userId)` is the single idempotent resolver in `lib/billing/repository.ts`, called by both checkout and portal handlers. It uses an upsert-on-conflict for local uniqueness (see §7).

**Trade-off accepted:** signup stays minimal; no Stripe API call on the signup path removes a failure mode. Cost is a small first-use latency and the idempotency handling that must exist and be tested. A rare true-concurrent race may leave at most one orphaned Stripe Customer object — this is not strict external API idempotency and no distributed lock is used; accepted at this scale.

### 3. Authentication

**Decision:** Email/password only in the initial UI, plus the forgot-password / password-recovery flow (§4). The auth module is structured so magic-link and OAuth can be added later without touching the database schema or route structure.

**Trade-off accepted:** initial auth surface is as small as possible. Adding a provider later is additive. A founder wanting OAuth on day one must add it following the documented extension point.

### 4. Teams and billing ownership

**Decision:** Subscriptions, customers, and entitlements stay strictly user-scoped in the core template. `getUserBillingOwnerId` provides a single code indirection point. Future organization billing requires a schema migration, RLS rewrite, and data migration — the indirection point does not substitute for these (§7, §9).

**Trade-off accepted:** core schema and RLS remain as simple as possible. The real complexity of Teams is deferred. The indirection point narrows the code blast radius but explicitly does not promise a configuration-only upgrade path.

### 5. Migration application

**Decision:** Manual Supabase migration deployment for now (§12), with an explicit destructiveness warning for `supabase db reset` and a documented migration-ordering discipline (apply migrations before deploying dependent code). A TODO records a future CI-approval-gated workflow.

**Trade-off accepted:** avoids putting a production-schema-altering credential into CI before it's needed. Cost is drift risk if the founder skips the migration step; `migration list` and `--dry-run` are the primary mitigations.

---

## 18. Open Issues

_This section exists only to record decisions that are **genuinely unresolved** at the time of this document version. It must be removed or emptied once all items are resolved._

Currently no open issues. All in-scope decisions have been resolved in §17. The following are acknowledged future concerns, not open decisions for the core template:

- Whether to add a Stripe webhook event for `customer.subscription.trial_will_end` (for trial-ending notifications) — deferred to when a product actually uses trials.
- Whether RLS tests against local Supabase should run in CI automatically or remain a local-only step — deferred to when a CI environment configuration is chosen.
