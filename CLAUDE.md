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
│   ├── modules/              # Optional modules (opt-in) — see §4
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
│   ├── guides/
│   │   ├── ai-agent-tips.md          # File structure + doc tips for AI agent workflows
│   │   ├── adding-a-module.md        # How to scaffold an optional module
│   │   ├── perplexity-github-connector.md
│   │   └── perplexity-supabase-connector.md
│   ├── playbook/             # Playbook content
│   ├── architecture.md       # System layers, request flows, entitlement logic
│   ├── implementation-plan.md
│   ├── schema.md
│   ├── decisions.md
│   ├── toolchain.md
│   └── prompt-plan.md
├── .github/
│   └── workflows/
│       └── ci.yml            # 3 parallel jobs: validate → build + test
├── .env.example
├── AGENTS.md                 # Tool-agnostic agent orientation (read before CLAUDE.md)
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
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Server-only
);

// ✅ CORRECT: Client-side (components, pages)
import { createBrowserClient } from '@supabase/ssr';
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

#### Row Level Security

All database tables **MUST** have RLS enabled. Default policy: **deny all**, then explicitly allow. Service-role access bypasses RLS unconditionally — never simulate it with an `auth.uid() IS NULL` policy. Full RLS expectations → [`docs/schema.md`](./docs/schema.md#rls-expectations).

```sql
-- ✅ CORRECT: Explicit user access
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- ❌ WRONG: Never disable RLS
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

#### Stripe Webhooks

- Treat webhooks as **source of truth** for subscription state
- Never trust client-side subscription updates
- Validate webhook signatures with `stripe.webhooks.constructEvent()`
- Log all events to `webhook_events` table (idempotency)
- Only 5 event types trigger a subscription upsert — see [`docs/schema.md` → Entitlement-Controlling Events](./docs/schema.md#entitlement-controlling-events)
- All other event types must be logged and acknowledged (200) without crashing

#### Webhook Transaction Boundary

The subscription upsert and `status = 'processed'` update **must execute in the same database transaction**. A crash must never leave a permanently misleading `processing` row.

```typescript
// lib/vendor/supabase/server.ts — inside webhook handler
await supabase.rpc('process_webhook_event', { event_id, subscription_data });
// The RPC wraps both writes in a single transaction.
```

Stale `processing` rows are recovered by a timeout reset — see [`docs/schema.md` → Atomic Webhook Processing](./docs/schema.md#atomic-webhook-processing) for the full SQL.

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

`lib/entitlements.ts` reads `BILLING_CONFIG.pastDueGracePeriod` — never hard-code the `past_due` rule inline. Full entitlement status table → [`docs/schema.md` → Entitlement Logic](./docs/schema.md#entitlement-logic).

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

See [`docs/guides/adding-a-module.md`](./docs/guides/adding-a-module.md) for the full module contract and scaffold steps.

- `lib/modules/workspaces/` — **requires new schema tables and may need a billing-owner relationship**
- `lib/modules/usage-billing/` — **requires new schema tables and billing-owner changes**
- `lib/modules/storage/`
- `lib/modules/email/`
- `lib/modules/analytics/`
- `lib/modules/sentry/`
- `lib/modules/ai/`
- `lib/modules/jobs/`

### 5. Vendor Code Isolation

All Supabase and Stripe code **MUST** be isolated in `lib/vendor/`. Makes vendor lock-in explicit; easier to swap if needed.

### 6. Environment Validation

`lib/env.ts` uses Zod to validate all required env vars at startup.

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

Pin **both** the Node SDK version in `package.json` and the API version string in `.env.local`. Upgrade them together and run the full test suite before deploying.

> **Current pinned values:** See [`docs/decisions.md` Decision #12](./docs/decisions.md) for the SDK version and API version string. Do not update those values here.
>
> **⚠️ Before upgrading to `stripe@18`:** Read Decision #16 first — it documents a breaking schema change affecting `current_period_start/end` field paths.

```typescript
// lib/vendor/stripe/client.ts
import Stripe from 'stripe';
import { env } from '@/lib/env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
});
```

**Never** read `apiVersion` from `process.env` directly — always go through the validated `env` object.

### 8. Database Types

`lib/database.types.ts` is generated from the live Supabase schema. Regenerate it after every migration:

```bash
npx supabase gen types typescript --project-id <project-ref> > lib/database.types.ts
```

Keep type aliases in sync when the schema changes:

```typescript
export type SubscriptionStatus = Database['public']['Enums']['subscription_status'];
export type WebhookEventStatus = Database['public']['Enums']['webhook_event_status'];
```

Never leave `lib/database.types.ts` empty or with placeholder types — CI will catch the type errors.

### 9. Nav Links

`MARKETING_NAV` and `DASHBOARD_NAV` are exported from `lib/config.ts` — single source of truth for all navigation. Components must import from there, never define their own arrays. `nav.test.ts` asserts shape, label uniqueness, and group isolation — update it if the nav shape changes.

### 10. Testing Strategy

**Framework:** Vitest. `tests/setup.ts` stubs all env vars required by `lib/env.ts`. Configured via `vitest.config.ts` `setupFiles`.

**Current test suite:**

| File                         | Status      | Covers                                                                          |
| ---------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `tests/config.test.ts`       | ✅ Active   | `APP_CONFIG` and `BILLING_CONFIG` shape                                         |
| `tests/entitlements.test.ts` | ✅ Active   | Access logic for all subscription statuses                                      |
| `tests/env.test.ts`          | ✅ Active   | Zod env schema — accepts valid, rejects invalid                                 |
| `tests/nav.test.ts`          | ✅ Active   | Nav shape, label uniqueness, group isolation                                    |
| `tests/rls.test.ts`          | ✅ Active   | RLS policy documentation tests                                                  |
| `tests/webhook.test.ts`      | 🔜 Skeleton | Idempotency, event routing, stale-processing — activates Phase 2                |
| `tests/billing.test.ts`      | 🔜 Skeleton | Checkout contract, status coverage, `BILLING_CONFIG` policy — activates Phase 2 |

**Fixtures:** `tests/fixtures/subscriptions.ts` — all 8 statuses; `tests/fixtures/webhook-events.ts` — all 5 entitlement events + ignored.

**Coverage targets:** Auth 100% · Webhooks 90% · Entitlements 100% · RLS 80%

### 11. CI

GitHub Actions at `.github/workflows/ci.yml` — 3 parallel jobs on every push/PR to `main`:

1. `validate` — lint + typecheck (~30s)
2. `build` — Next.js production build (after validate)
3. `test` — Vitest + coverage (after validate, parallel with build)

All three must pass before merging.

### 12. Deployment

**Platform:** Vercel (free tier). Region: `syd1`. See `vercel.json` for build config.

---

## Documentation Hygiene

## Scope and Separation of Concerns

| File                          | Answers                                                    | Does NOT answer                                             |
| ----------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `AGENTS.md`                   | Where does X live, and how do I run it?                    | Why is it built this way?                                   |
| `CLAUDE.md`                   | What are the implementation rules?                         | What version are we pinned to? _(→ `docs/decisions.md`)_    |
| `docs/architecture.md`        | How does a request flow through the system?                | Why was it built this way?                                  |
| `docs/schema.md`              | What's the full SQL contract?                              | Why is it shaped this way?                                  |
| `docs/decisions.md`           | Why was this choice made?                                  | What's the rule for using it?                               |
| `docs/implementation-plan.md` | What needs to be implemented, and what phase are we at?    | What's the exact agent prompt for this step?                |
| `docs/prompt-plan.md`         | What's the exact prompt/step text for this agent workflow? | What's the overall task list or phase status?               |
| `docs/guides/*`               | How do I do this specific task?                            | What's the architectural rule behind it?                    |
| `README.md`                   | How do I set up, run, migrate, and deploy this — and why?  | What's the implementation rule?                             |
| `CHANGELOG.md`                | What changed, and in which version?                        | Why did it change? _(→ `docs/decisions.md`)_                |
| `tests/README.md`             | How is the test suite organized and run?                   | What implementation rule is being tested? _(→ `CLAUDE.md`)_ |

### Rules for writing documentation

- Move content once, link from elsewhere — never copy.
- Version numbers and risks live in `docs/decisions.md` only; `CLAUDE.md` and `docs/implementation-plan.md` reference them, never duplicate them.
- `AGENTS.md`'s constraints section is a summary with links, not a copy.
- The directory tree in `CLAUDE.md` Section 1 is the single source of truth for repo structure; update it in the same commit that adds, moves, or deletes any file or folder.
- Re-run the DRY audit after major structural changes (trigger phrase: "audit documentation for DRYness").
- Fix factual doc bugs immediately when found.

## Keeping This File Fresh

- Convention changes → update here **and** `docs/decisions.md`
- Version changes → update `docs/decisions.md` Decision #12 only
- File added/moved → update directory tree in §1
- Test file added/status changed → update test table in §10
- New stage → re-read and verify against `docs/decisions.md`

> Risks, non-goals, and ADR rationale → [`docs/decisions.md`](./docs/decisions.md)

---

**Remember:** This is a **starter repository**, not a production SaaS. Ship fast, iterate, add complexity only when needed.
