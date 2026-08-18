# CLAUDE.md — Implementation Rules

## Project Context

This is a **minimal, maintainable modular monolith** for solo-founder subscription SaaS products. Every decision prioritizes shipping speed, maintainability, and security.

---

## Core Stack (Non-Negotiable)

- **Next.js 14+** with App Router (Server Components by default)
- **TypeScript** in strict mode
- **Tailwind CSS** for styling
- **shadcn/ui-style** components (copy-paste, not library)
- **Supabase PostgreSQL** with Row Level Security
- **Supabase Auth** (email/password + OAuth)
- **Stripe** (Checkout, Customer Portal, Webhooks)
- **Vercel** for deployment
- **npm** — do not switch to pnpm or yarn; npm is pre-installed with Node and avoids lockfile conflicts

---

## Implementation Rules

### 1. Directory Structure

```text
/
├── app/
│ ├── (marketing)/ # Public pages (/, /pricing, /about)
│ ├── (auth)/ # Auth pages (/login, /signup, /forgot-password)
│ ├── (dashboard)/ # Protected pages (/dashboard, /profile, /billing)
│ ├── api/
│ │ ├── stripe/
│ │ │ ├── checkout/route.ts
│ │ │ ├── portal/route.ts
│ │ │ └── webhook/route.ts
│ │ └── auth/
│ │ └── callback/route.ts
│ ├── layout.tsx
│ └── globals.css
├── components/
│ ├── ui/ # shadcn/ui-style components
│ ├── marketing/ # Public page components
│ ├── dashboard/ # Protected page components
│ └── shared/ # Shared components (nav, footer)
├── lib/ # Canonical path — do NOT use src/lib/
│ ├── vendor/
│ │ ├── supabase/
│ │ │ ├── client.ts
│ │ │ ├── server.ts
│ │ │ └── rls.ts
│ │ └── stripe/
│ │ ├── client.ts
│ │ ├── checkout.ts
│ │ ├── portal.ts
│ │ └── webhook.ts
│ ├── modules/ # Optional modules (opt-in)
│ ├── config.ts # Central product configuration (includes billing policy)
│ ├── env.ts # Environment validation (Zod)
│ └── entitlements.ts # Subscription entitlement logic
├── supabase/
│ └── migrations/
│ └── 0001_initial.sql # Initial migration — must exist before Stage 3
├── docs/
│ ├── implementation-plan.md
│ ├── schema.md
│ └── decisions.md
├── tests/
│ ├── entitlements.test.ts
│ ├── webhook.test.ts
│ └── rls.test.ts
├── .env.example
├── README.md
└── CLAUDE.md
```

**Naming rules:**

- Use `lib/` at the project root. Never use `src/lib/` or mix the two.
- The webhook event log table is named `webhook_events` everywhere — in SQL, code, and docs. Never use `stripe_events`.

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

`lib/entitlements.ts` reads this value — never hard-code the `past_due` rule inline. The safest default is `false` (no access).

### 4. Scope Boundaries

#### Core Features (Mandatory)

- Public marketing page (`/`)
- Authentication (`/login`, `/signup`, `/auth/callback`)
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

```typescript
// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_ID_PRO: z.string().startsWith("price_"),
  STRIPE_API_VERSION: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

**Validation runs on:**

- `npm run dev`
- `npm run build`
- Vercel deployment (via `vercel.json` prebuild script)

### 7. Stripe SDK & API Version Pinning

Pin **both** the Node SDK version in `package.json` and the API version string in `.env.local`. Upgrade them together and run the full test suite before deploying.

```json
// package.json — pin a specific major version
"stripe": "16.x"
```

```bash
# .env.local
STRIPE_API_VERSION=2024-06-20
```

```typescript
// lib/vendor/stripe/client.ts
import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
});
```

**Never** read `apiVersion` from `process.env` directly in the Stripe constructor — always go through the validated `env` object.

### 8. Testing Strategy

**Framework:** Vitest (lightweight, fast)

**Coverage Targets:**

- Authentication flow: 100%
- Webhook handlers: 90%
- Entitlement logic: 100%
- RLS policies: 80%

**Test Structure:**

```text
tests/
├── entitlements.test.ts
├── webhook.test.ts
├── rls.test.ts
└── fixtures/
├── subscriptions.ts
└── webhook-events.ts
```

```typescript
// tests/entitlements.test.ts
import { describe, it, expect } from "vitest";
import { hasActiveSubscription } from "@/lib/entitlements";

describe("hasActiveSubscription", () => {
  it("returns true for active subscription", () => {
    expect(hasActiveSubscription({ status: "active" })).toBe(true);
  });

  it("returns false for past_due when grace period is disabled", () => {
    expect(hasActiveSubscription({ status: "past_due" })).toBe(false);
  });

  it("returns false for canceled subscription", () => {
    expect(hasActiveSubscription({ status: "canceled" })).toBe(false);
  });

  it("returns false for no subscription", () => {
    expect(hasActiveSubscription(null)).toBe(false);
  });
});
```

### 9. Deployment Strategy

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

## Decisions Requiring Your Approval

1. **Database Schema:** Are the `profiles`, `subscriptions`, and `webhook_events` tables sufficient?
2. **Webhook Pattern:** Is the atomic DB-based claim acceptable, or do you prefer Redis for performance?
3. **Optional Modules:** Which modules do you need in the next 6 months?
4. **Testing Strategy:** Is Vitest + 70% coverage appropriate?
5. **Deployment:** Is Vercel + Supabase your preferred stack?

---

## Potential Risks

| Risk                      | Mitigation                                      |
| ------------------------- | ----------------------------------------------- |
| Webhook race conditions   | Atomic claim + transaction boundary             |
| Stale processing rows     | updated_at timeout recovery query (see README)  |
| RLS misconfiguration      | Test policies, deny-by-default                  |
| Stripe API version drift  | Pin SDK + API version together, test on upgrade |
| Vendor lock-in (Supabase) | Standard SQL, exportable data                   |
| Vercel cold starts        | Pro tier, optimize bundle size                  |

---

**Remember:** This is a **starter repository**, not a production SaaS. Ship fast, iterate, add complexity only when needed.
