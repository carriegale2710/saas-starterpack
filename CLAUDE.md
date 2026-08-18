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

---

## Implementation Rules

### 1. Directory Structure

```
/
├── app/
│   ├── (marketing)/      # Public pages (/, /pricing, /about)
│   ├── (auth)/           # Auth pages (/login, /signup, /forgot-password)
│   ├── (dashboard)/      # Protected pages (/dashboard, /profile, /billing)
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
│   ├── ui/               # shadcn/ui-style components
│   ├── marketing/        # Public page components
│   ├── dashboard/        # Protected page components
│   └── shared/           # Shared components (nav, footer)
├── lib/
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
│   ├── modules/          # Optional modules (opt-in)
│   ├── config.ts         # Central product configuration
│   ├── env.ts            # Environment validation (Zod)
│   └── entitlements.ts   # Subscription entitlement logic
├── docs/
│   ├── implementation-plan.md
│   ├── schema.md
│   └── decisions.md
├── tests/
│   ├── entitlements.test.ts
│   ├── webhook.test.ts
│   └── rls.test.ts
├── .env.example
├── README.md
└── CLAUDE.md
```

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
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, // Anon key only
);
```

#### Row Level Security

All database tables **MUST** have RLS enabled. Default policy: **deny all**, then explicitly allow user access.

```sql
-- ✅ CORRECT: Explicit user access
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- ❌ WRONG: No RLS policy (data exposed)
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

#### Stripe Webhooks

- Treat webhooks as **source of truth** for subscription state
- Never trust client-side subscription updates
- Validate webhook signatures with `stripe.webhooks.constructEvent()`
- Log all events to `webhook_events` table (idempotency)

### 3. Scope Boundaries

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

- Workspaces and teams (`lib/modules/workspaces/`)
- Usage-based billing (`lib/modules/usage-billing/`)
- Supabase Storage (`lib/modules/storage/`)
- Resend email (`lib/modules/email/`)
- PostHog analytics (`lib/modules/analytics/`)
- Sentry error tracking (`lib/modules/sentry/`)
- AI integrations (`lib/modules/ai/`)
- Background jobs (`lib/modules/jobs/`)

**Module Contract:**

```typescript
// lib/modules/<module>/index.ts
export function init(): void;  // Register routes, hooks
export type { <ModuleType> };  // Export types
```

Modules:

- Have their own database migrations
- Do not modify core tables
- Can be removed without breaking core
- Are opt-in (not installed by default)

### 4. Vendor Code Isolation

All Supabase and Stripe code **MUST** be isolated in `lib/vendor/`:

```
lib/vendor/
├── supabase/
│   ├── client.ts      # Browser client
│   ├── server.ts      # Server client (service role)
│   └── rls.ts         # RLS helper functions
└── stripe/
    ├── client.ts      # Stripe SDK initialization
    ├── checkout.ts    # Checkout Session creation
    ├── portal.ts      # Portal Session creation
    └── webhook.ts     # Webhook handling
```

**Rationale:** Makes vendor lock-in explicit; easier to swap if needed.

### 5. Environment Validation

Use Zod to validate environment variables at runtime:

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
  STRIPE_API_VERSION: z.string(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

**Validation runs on:**

- `npm run dev` (development)
- `npm run build` (production build)
- Vercel deployment (via `vercel.json` prebuild script)

### 6. Stripe API Version Pinning

**Always** pin Stripe API version in environment:

```bash
# .env.local
STRIPE_API_VERSION=2024-06-20
```

```typescript
// lib/vendor/stripe/client.ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: process.env.STRIPE_API_VERSION,
});
```

**Upgrade Process:**

1. Check [Stripe API changelog](https://stripe.com/docs/upgrades)
2. Update `STRIPE_API_VERSION` in `.env.local`
3. Test all Stripe integrations (Checkout, Portal, Webhooks)
4. Update webhook event handling if needed
5. Deploy

### 7. Testing Strategy

**Framework:** Vitest (lightweight, fast)

**Coverage Targets:**

- Authentication flow: 100%
- Webhook handlers: 90%
- Entitlement logic: 100%
- RLS policies: 80%

**Test Structure:**

```
tests/
├── entitlements.test.ts    # Entitlement logic unit tests
├── webhook.test.ts         # Webhook handler integration tests
├── rls.test.ts             # RLS policy tests (Supabase helpers)
└── fixtures/
    ├── subscriptions.ts    # Test subscription data
    └── webhook-events.ts   # Test webhook payloads
```

**Example Test:**

```typescript
// tests/entitlements.test.ts
import { describe, it, expect } from "vitest";
import { hasActiveSubscription } from "@/lib/entitlements";

describe("hasActiveSubscription", () => {
  it("returns true for active subscription", () => {
    const subscription = { status: "active", current_period_end: new Date() };
    expect(hasActiveSubscription(subscription)).toBe(true);
  });

  it("returns false for canceled subscription", () => {
    const subscription = { status: "canceled", current_period_end: new Date() };
    expect(hasActiveSubscription(subscription)).toBe(false);
  });

  it("returns false for no subscription", () => {
    expect(hasActiveSubscription(null)).toBe(false);
  });
});
```

### 8. Deployment Strategy

**Platform:** Vercel (free tier sufficient for MVP)

**Pre-deployment Checklist:**

- [ ] Environment variables set in Vercel dashboard
- [ ] Supabase production project linked
- [ ] Stripe live mode keys configured
- [ ] Webhook endpoint updated to production URL
- [ ] Custom domain configured (optional)
- [ ] Database migrations pushed to production

**Vercel Configuration:**

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["syd1"] // Sydney for AU users
}
```

**Post-deployment:**

1. Test signup flow end-to-end
2. Test Checkout + webhook synchronization
3. Test Customer Portal updates
4. Monitor webhook logs for failures

---

## Decisions Requiring Your Approval

Before I proceed with implementation, please confirm:

1. **Database Schema:** Are the `profiles`, `subscriptions`, and `webhook_events` tables sufficient? Any missing fields or relationships?

2. **Webhook Pattern:** Is the atomic claim pattern (DB-based, no Redis) acceptable for your use case, or do you prefer Redis for performance?

3. **Optional Modules:** Which optional modules do you anticipate needing in the next 6 months? (workspaces, usage-billing, storage, email, analytics, AI)

4. **Testing Strategy:** Is Vitest + 70% coverage target appropriate, or do you prefer a different testing framework/coverage goal?

5. **Deployment:** Is Vercel + Supabase your preferred stack, or do you have alternative hosting requirements (AWS, self-hosted)?

---

## Contradictions & Complexity Review

### Identified Contradictions

**None found.** The architecture is internally consistent:

- Modular monolith aligns with minimal dependencies
- RLS + Supabase aligns with "never expose service-role key"
- Webhooks as source of truth aligns with atomic claim pattern

### Unnecessary Complexity

**None identified.** All complexity is justified:

- Webhook infrastructure is necessary for billing accuracy
- RLS is necessary for security (no simpler alternative)
- Environment validation is necessary for production reliability

### Potential Risks

| Risk                      | Mitigation                             |
| ------------------------- | -------------------------------------- |
| Webhook race conditions   | Atomic claim pattern, idempotency keys |
| RLS misconfiguration      | Test policies, deny-by-default         |
| Stripe API version drift  | Pin version, document upgrade path     |
| Vendor lock-in (Supabase) | Standard SQL, exportable data          |
| Vercel cold starts        | Pro tier, optimize bundle size         |

---

## Next Steps

1. **Review this document** for accuracy and completeness
2. **Answer the 5 decision questions** above
3. **Request any changes** to architecture or scope
4. **Begin implementation** (Phase 1: Foundation)

---

**Remember:** This is a **starter repository**, not a production SaaS. Ship fast, iterate based on user feedback, and add complexity only when needed.
