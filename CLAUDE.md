# CLAUDE.md — Implementation Rules

<!-- This file owns: coding rules, security constraints, directory structure, naming conventions. -->
<!-- It does NOT own: version numbers, risk tables, ADR rationale — those live in docs/decisions.md. -->
<!-- Before every stage: verify this file is consistent with docs/decisions.md and docs/implementation-plan.md. -->

## Project Context

This is a **minimal, maintainable modular monolith** for solo-founder subscription SaaS products. Every decision prioritizes shipping speed, maintainability, and security.

---

## Core Stack (Non-Negotiable)

- **Next.js 15** with App Router (Server Components by default)
- **TypeScript** in strict mode
- **Tailwind CSS** for styling
- **shadcn/ui-style** components (copy-paste, not library)
- **Supabase PostgreSQL** with Row Level Security
- **Supabase Auth** (email/password + OAuth)
- **Stripe** (Checkout, Customer Portal, Webhooks) — Phase 2
- **Vercel** for deployment
- **npm** — do not switch to pnpm or yarn; npm is pre-installed with Node and avoids lockfile conflicts. The lockfile is `package-lock.json` — commit it, never `.gitignore` it.
- **Node.js 22 LTS** — target runtime. Node 20 is deprecated on Vercel from October 2026. `.nvmrc` pins `22`.

---

## Implementation Rules

### 1. Directory Structure

```text
/
├── app/
│   ├── (marketing)/          # Public pages (/, /pricing, /about)
│   ├── (auth)/               # Auth pages (/login, /signup, /forgot-password)
│   ├── (dashboard)/          # Protected pages (/dashboard, /profile, /billing)
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts
│   │   │   ├── portal/route.ts
│   │   │   └── webhook/route.ts
│   │   └── auth/
│   │       └── callback/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                   # shadcn/ui-style components
│   ├── marketing/            # Public page components
│   ├── dashboard/            # Protected page components
│   └── shared/               # Shared components (nav, footer)
├── lib/                      # Canonical path — do NOT use src/lib/
│   ├── vendor/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── rls.ts
│   │   └── stripe/
│   │       ├── client.ts
│   │       ├── checkout.ts
│   │       ├── portal.ts
│   │       └── webhook.ts
│   ├── modules/              # Optional modules (opt-in)
│   ├── config.ts             # Central product configuration (includes billing policy)
│   ├── database.types.ts     # Generated from Supabase schema — regenerate after migrations
│   ├── env.ts                # Environment validation (Zod)
│   └── entitlements.ts       # Subscription entitlement logic
├── supabase/
│   └── migrations/
│       └── 0001_initial.sql
├── tests/
│   ├── fixtures/
│   │   ├── subscriptions.ts  # Typed MockSubscription for all 8 statuses
│   │   └── webhook-events.ts # Stripe event payloads for all 5 entitlement events + ignored
│   ├── setup.ts              # Stubs env vars — must stay in sync with lib/env.ts
│   ├── config.test.ts
│   ├── entitlements.test.ts
│   ├── env.test.ts
│   ├── nav.test.ts
│   ├── rls.test.ts
│   ├── webhook.test.ts       # Skeleton — activates in Phase 2
│   ├── billing.test.ts       # Skeleton — activates in Phase 2
│   └── README.md
├── docs/
│   ├── archive/              # Superseded drafts
│   ├── guides/               # How-to guides
│   ├── microsaas-playbook/   # Playbook content
│   ├── implementation-plan.md
│   ├── schema.md
│   ├── decisions.md
│   └── prompt-plan.md
├── .github/
│   └── workflows/
│       └── ci.yml            # 3 parallel jobs: validate → build + test
├── .env.example
├── CHANGELOG.md
├── README.md
└── CLAUDE.md
```

**Naming rules:**

- Use `lib/` at the project root. Never use `src/lib/` or mix the two.
- The webhook event log table is named `webhook_events` everywhere — in SQL, code, and docs. Never use `stripe_events`.
- Nav links (`MARKETING_NAV`, `DASHBOARD_NAV`) live in `lib/config.ts` — single source of truth. Never duplicate them in component files.

### 2. Security Constraints

#### Supabase Service-Role Key

**NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code.

```typescript
// ✅ CORRECT: Server-side only (api/routes)
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Server-only
);

// ✅ CORRECT: Client-side (components, pages)
import { createBrowserClient } from "@supabase/ssr";
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
```

#### Row Level Security

All database tables **MUST** have RLS enabled. Default policy: **deny all**, then explicitly allow.

```sql
-- ✅ CORRECT: Explicit user access
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- ❌ WRONG: Never disable RLS
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

**Service-role access bypasses RLS entirely.** It does not need a policy and must not be simulated with an `auth.uid() IS NULL` policy. Privileged tables such as `webhook_events` must have **no authenticated-user policies** — the absence of a matching policy is the access control.

#### Stripe Webhooks

- Treat webhooks as **source of truth** for subscription state
- Never trust client-side subscription updates
- Validate webhook signatures with `stripe.webhooks.constructEvent()`
- Log all events to `webhook_events` table (idempotency)

#### Entitlement-Controlling Stripe Events

Only these events trigger a subscription upsert:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid` — confirms `active` status after successful payment
- `invoice.payment_failed` — moves status to `past_due`

All other event types must be logged and acknowledged without crashing. Never reject unknown event types with a non-200 response.

#### Webhook Transaction Boundary

The event state update (`status = 'processed'`) and the subscription upsert **must execute in the same database transaction**. A crash must never leave a permanently misleading `processing` row. Use a transaction wrapper:

```typescript
// lib/vendor/supabase/server.ts — inside webhook handler
await supabase.rpc("process_webhook_event", { event_id, subscription_data });
// The RPC wraps both the upsert and status update in a single transaction.
```

Stale `processing` rows (worker crash before commit) are recovered by resetting them after a timeout — see README for the recovery query. Add `updated_at` to `webhook_events` to support this.

### 3. Entitlement Policy

The `past_due` access decision is a **product decision** defined in `lib/config.ts`:

```typescript
// lib/config.ts
export const BILLING_CONFIG = {
  // Default: deny access on past_due. Set to true only if you deliberately
  // want a grace period (e.g., read-only access while Stripe retries payment).
  pastDueGracePeriod: false,
} as const;
```

`lib/entitlements.ts` reads `BILLING_CONFIG.pastDueGracePeriod` — never hard-code the `past_due` rule inline. The safest default is `false` (no access).

### 4. Scope Boundaries

#### Core Features (Mandatory)

- Public marketing page (`/`)
- Authentication (`/login`, `/signup`) and OAuth callback (`/auth/callback` — exchanges the code for a session via `supabase.auth.exchangeCodeForSession()`, then redirects to `/dashboard`)
- Password recovery (`/forgot-password`, `/reset-password`)
- Protected dashboard (`/dashboard`)
- User profile (`/profile`)
- Supabase database access (with RLS)
- Stripe Checkout (`/api/stripe/checkout`)
- Stripe Customer Portal (`/api/stripe/portal`)
- Stripe webhook synchronization (`/api/stripe/webhook`)
- Subscription entitlements (`lib/entitlements.ts`)
- Central product configuration (`lib/config.ts`)
- Environment validation (`lib/env.ts`)
- Basic tests (Vitest)
- README and CLAUDE.md

#### Optional Modules (Do Not Include by Default)

- Workspaces and teams (`lib/modules/workspaces/`) — **requires new schema tables and may need a billing-owner relationship**
- Usage-based billing (`lib/modules/usage-billing/`) — **requires new schema tables and billing-owner changes**
- Supabase Storage (`lib/modules/storage/`)
- Resend email (`lib/modules/email/`)
- PostHog analytics (`lib/modules/analytics/`)
- Sentry error tracking (`lib/modules/sentry/`)
- AI integrations (`lib/modules/ai/`)
- Background jobs (`lib/modules/jobs/`)

**Module Contract:**

```typescript
// lib/modules/<module>/index.ts
export function init(): void;
export type { <ModuleType> };
```

Modules:

- Have their own database migrations
- Do not modify core tables (workspaces/usage-billing are exceptions — they require schema additions, documented in their own `migrations/` folder)
- Can be removed without breaking core
- Are opt-in (not installed by default)

### 5. Vendor Code Isolation

All Supabase and Stripe code **MUST** be isolated in `lib/vendor/`.

**Rationale:** Makes vendor lock-in explicit; easier to swap if needed.

### 6. Environment Validation

`lib/env.ts` uses Zod to validate all required env vars at startup. The schema currently validates Phase 1 vars only. Phase 2 will add Stripe vars.

**Phase 1 schema (current):**

```typescript
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});
```

**Phase 2 additions (to be added with Stripe work):**

```typescript
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_ID_PRO: z.string().startsWith("price_"),
  STRIPE_API_VERSION: z.string().min(1),
```

**Validation runs on:** `npm run dev`, `npm run build`, Vercel deployment.

**`tests/setup.ts` rule:** if `lib/env.ts` adds a new required variable, add a matching stub in `tests/setup.ts`. Never put real keys there.

### 7. Stripe SDK & API Version Pinning

<!-- sync: docs/decisions.md Decision #12 and Decision #16 own the specific version values. -->
<!-- Do not hardcode version numbers here — always read them from decisions.md. -->

Pin **both** the Node SDK version in `package.json` and the API version string in `.env.local`. Upgrade them together and run the full test suite before deploying.

> **Current pinned values:** See [`docs/decisions.md` Decision #12](./docs/decisions.md) for the SDK version (`stripe@17.x`) and API version (`STRIPE_API_VERSION=2025-11-20.acacia`). Do not update those values here — update them in `decisions.md` only, which is the single source of truth.
>
> **⚠️ Before upgrading to `stripe@18`:** Read Decision #16 first — it documents a breaking schema change that affects `current_period_start/end` field paths.

```typescript
// lib/vendor/stripe/client.ts
import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
});
```

**Never** read `apiVersion` from `process.env` directly in the Stripe constructor — always go through the validated `env` object.

### 8. Database Types

`lib/database.types.ts` is generated from the live Supabase schema. Regenerate it after every migration:

```bash
npx supabase gen types typescript --project-id <project-ref> > lib/database.types.ts
```

The file also exports convenience type aliases — keep them in sync when the schema changes:

```typescript
export type SubscriptionStatus = Database['public']['Enums']['subscription_status'];
export type WebhookEventStatus = Database['public']['Enums']['webhook_event_status'];
```

Never leave `lib/database.types.ts` empty or with placeholder types — CI will catch the type errors.

### 9. Nav Links

`MARKETING_NAV` and `DASHBOARD_NAV` are exported from `lib/config.ts`. They are the **single source of truth** for all navigation.

- Components must import from `lib/config.ts`, never define their own nav arrays
- `nav.test.ts` asserts shape, label uniqueness, and group isolation — update it if the nav shape changes

### 10. Testing Strategy

**Framework:** Vitest (lightweight, fast, native ESM)

**Setup file:** `tests/setup.ts` stubs all env vars required by `lib/env.ts` so imports don't crash. Configured via `vitest.config.ts` `setupFiles`.

**Current test suite:**

| File | Status | Covers |
|---|---|---|
| `tests/config.test.ts` | ✅ Active | `APP_CONFIG` and `BILLING_CONFIG` shape |
| `tests/entitlements.test.ts` | ✅ Active | Access logic for all subscription statuses |
| `tests/env.test.ts` | ✅ Active | Zod env schema — accepts valid, rejects invalid |
| `tests/nav.test.ts` | ✅ Active | Nav shape, label uniqueness, group isolation |
| `tests/rls.test.ts` | ✅ Active | RLS policy documentation tests |
| `tests/webhook.test.ts` | 🔜 Skeleton | Idempotency, event routing, stale-processing — activates Phase 2 |
| `tests/billing.test.ts` | 🔜 Skeleton | Checkout contract, status coverage, `BILLING_CONFIG` policy — activates Phase 2 |

**Fixtures (in `tests/fixtures/`):**

- `subscriptions.ts` — typed `MockSubscription` for all 8 statuses; keyed as `Record<SubscriptionStatus, MockSubscription>`
- `webhook-events.ts` — Stripe event payloads for all 5 entitlement-controlling events + `ignoredEventFixtures`

**Coverage Targets:**

- Authentication flow: 100%
- Webhook handlers: 90%
- Entitlement logic: 100%
- RLS policies: 80%

### 11. CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push and PR to `main` — **3 parallel jobs:**

1. `validate` — lint + typecheck (~30s), runs first
2. `build` — Next.js production build, runs after validate
3. `test` — Vitest + coverage, runs after validate (parallel with build)

All three must pass before merging. Do not bypass CI.

### 12. Deployment Strategy

**Platform:** Vercel (free tier sufficient for MVP)

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["syd1"]
}
```

---

## Keeping This File Fresh

This file owns **rules**, never **values**. Specific version numbers, risk tables, and ADR rationale live in `docs/decisions.md`.

- When a convention changes → update this file **and** `docs/decisions.md`
- When a version changes → update `docs/decisions.md` Decision #12 only; this file points there
- When a file is added or moved → update the directory tree in Section 1
- When a test file is added or its status changes → update the test table in Section 10
- When starting a new stage → re-read this file and verify it matches `docs/decisions.md`
- Sections marked `<!-- sync: decisions.md -->` mirror a value owned elsewhere — check them first when upgrading dependencies

> Risks and non-goals are documented in [`docs/decisions.md`](./docs/decisions.md) — not here.

---

## Decisions Requiring Your Approval

<!-- sync: docs/decisions.md "Decisions Requiring Approval" section owns the canonical list -->

1. **Database Schema:** Are the `profiles`, `subscriptions`, and `webhook_events` tables sufficient?
2. **Webhook Pattern:** Is the atomic DB-based claim acceptable, or do you prefer Redis for performance?
3. **Optional Modules:** Which modules do you need in the next 6 months?
4. **Testing Strategy:** Is Vitest + 70% coverage appropriate?
5. **Deployment:** Is Vercel + Supabase your preferred stack?

---

**Remember:** This is a **starter repository**, not a production SaaS. Ship fast, iterate, add complexity only when needed.
