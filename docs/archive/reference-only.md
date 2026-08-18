# Reference Only — Earlier Architecture Rationale

**Purpose:** This file preserves only the essential context from earlier architecture drafts that may be useful in later stages. It is **not** an implementation contract. For authoritative decisions, schema, and implementation rules, use:

- `docs/decisions.md`
- `docs/schema.md`
- `docs/implementation-plan.md`
- `docs/prompt-plan.md`
- `README.md`
- `CLAUDE.md`

---

## 1. Dependency Rationale (Why Each Core Dependency Exists)

Use this when evaluating whether to add a new dependency in Stages 2–5.

| Dependency                 | Purpose         | Why Needed                                                    | Simpler Alternative Rejected |
| -------------------------- | --------------- | ------------------------------------------------------------- | ---------------------------- |
| `next`                     | Framework       | Required for App Router, Server Components, Vercel deployment | N/A                          |
| `react`                    | UI library      | Required by Next.js                                           | N/A                          |
| `@supabase/supabase-js`    | Database client | Managed PostgreSQL with RLS, Auth, Storage                    | Raw fetch (too verbose)      |
| `@supabase/ssr`            | SSR helpers     | Cookie handling, session middleware for App Router            | Manual cookies (error-prone) |
| `stripe`                   | Billing SDK     | Checkout, Portal, Webhooks, subscriptions                     | Raw API calls (too verbose)  |
| `zod`                      | Validation      | Runtime environment validation, input schemas                 | Manual checks (error-prone)  |
| `vitest`                   | Testing         | Lightweight unit/integration tests                            | Jest (heavier)               |
| `tailwindcss`              | Styling         | Rapid UI development, small bundle                            | Plain CSS (slower)           |
| `class-variance-authority` | Variant helpers | shadcn/ui-style component variants                            | Manual classes (verbose)     |
| `clsx` / `tailwind-merge`  | Class utilities | Conditional class merging                                     | Manual (error-prone)         |
| `lucide-react`             | Icons           | Consistent iconography                                        | SVG files (verbose)          |

**Optional (only if concrete product need exists):**

| Dependency       | Purpose        | When to Add                               |
| ---------------- | -------------- | ----------------------------------------- |
| `posthog-js`     | Analytics      | When you need product analytics           |
| `@sentry/nextjs` | Error tracking | When you need production error monitoring |
| `resend`         | Email sending  | When you need transactional emails        |

**Explicitly Rejected (do not add speculatively):**

- `prisma` / `drizzle` — ORM not needed for simple schema
- `redux` / `zustand` — React Context + Server Components sufficient
- `redis` — Database row locking sufficient for webhooks
- `docker` — Vercel deployment is simpler
- `graphql` / `apollo` — REST API routes sufficient

---

## 2. Architectural Alternatives Considered

Use this when tempted to redesign the architecture in later stages.

### Why Not Microservices?

- **Pros:** Independent scaling, team parallelism
- **Cons:** Operational complexity, deployment overhead
- **Verdict:** Premature optimization for solo founder

### Why Not Separate Backend?

- **Pros:** Clear API boundaries
- **Cons:** Two repos to maintain, CORS complexity
- **Verdict:** Next.js API routes sufficient

### Why Not ORM?

- **Pros:** Type-safe queries, migrations
- **Cons:** Heavy, slow cold starts, vendor lock-in
- **Verdict:** Raw SQL + Supabase client is simple enough

### Why Not Component Library?

- **MUI/Chakra:** Large bundle, hard to customize
- **Tailwind UI:** Paid, less flexible
- **Radix + Tailwind (shadcn pattern):** Full control, minimal bundle, accessible

### Why Not Redis for Webhooks?

- **Pros:** Fast, purpose-built for locks
- **Cons:** Extra dependency, cost, operational overhead
- **Verdict:** Database row locking is good enough

---

## 3. Security Model Summary

Use this during Stage 7 (Security Review) to verify nothing was missed.

### Supabase Service-Role Key

- **Never** expose to client-side code
- **Only** used in:
  - `/api/stripe/webhook` route
  - Narrow server-only billing repository
- All other queries use anon key + RLS

### Row Level Security

- All tables have RLS enabled
- Default policy: deny all, then explicitly allow user access
- Service role bypasses RLS (no user-facing policy needed)
- Test policies with multiple users

### Stripe Webhooks

- Verify signature before parsing or database access
- Atomic event claim: `INSERT ... ON CONFLICT DO NOTHING`
- Track `processing`, `processed`, `failed` states
- Return 2xx only after successful processing
- Return non-2xx after failure so Stripe retries
- Unknown events logged but not rejected

### Entitlements

- Never grant access from Checkout redirect
- Never trust client-provided subscription status
- Entitlement comes only from webhook-synced database state
- Unknown subscription status → no access (deny by default)

---

## 4. Stripe Event Coverage

Use this during Stage 4 (Stripe Billing) to verify all events are handled.

**Required Events:**

| Event                           | Action                                                      |
| ------------------------------- | ----------------------------------------------------------- |
| `checkout.session.completed`    | Create/update subscription record                           |
| `customer.subscription.created` | Create subscription                                         |
| `customer.subscription.updated` | Update subscription status                                  |
| `customer.subscription.deleted` | Mark subscription canceled                                  |
| `invoice.paid`                  | Update `current_period_end`, maintain recurring entitlement |
| `invoice.payment_failed`        | Set status `past_due`                                       |

**Unknown Events:**

- Log event type and payload
- Acknowledge with 2xx
- Do not change entitlements

**Unknown Subscription Statuses:**

- Preserve in database
- Resolve to no access

---

## 5. Migration Safety Checklist

Use this before any production deployment.

```bash
# 1. Inspect pending migrations
supabase migration list

# 2. Dry run (local)
supabase db push --dry-run

# 3. Review generated SQL

# 4. Apply to remote
supabase db push

# 5. Verify migration list after deployment
supabase migration list

# 6. Deploy application code that depends on migrations
vercel --prod
```

**Warning:** `supabase db reset` is **local-only** and **destructive**. Never use for remote deployment.

---

## 6. Testing Strategy Reference

Use this during Stage 6 (Testing and Documentation).

### Vitest Coverage Targets

| Area                           | Target |
| ------------------------------ | ------ |
| Environment validation         | 100%   |
| Authentication input schemas   | 100%   |
| Protected route behavior       | 100%   |
| Profile authorization          | 100%   |
| Webhook signature validation   | 100%   |
| Webhook idempotency            | 100%   |
| Subscription status mapping    | 100%   |
| Entitlement checks             | 100%   |
| Checkout authorization         | 100%   |
| Optional integrations disabled | 100%   |

### Playwright Coverage

| Flow                      | Test                        |
| ------------------------- | --------------------------- |
| Public homepage           | Renders without auth        |
| Signup flow               | Navigation, form submission |
| Login flow                | Navigation, form submission |
| Unauthenticated dashboard | Redirects to login          |
| Authenticated dashboard   | Renders with session        |
| Pricing page              | Renders, plan selection     |
| Billing page              | Renders, Portal link        |

### Manual Stripe Verification

Do not automate Stripe-hosted Checkout in CI. Instead:

```bash
# 1. Start Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 2. Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.paid

# 3. Verify webhook delivery and database updates

# 4. Test payment failure
stripe trigger invoice.payment_failed
```

---

## 7. Environment Variables Reference

Use this when setting up Stage 2 (Foundation) and Stage 4 (Stripe Billing).

### Required

| Variable                        | Description                         | Example                   |
| ------------------------------- | ----------------------------------- | ------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client)          | `eyJ...`                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role (server only) | `eyJ...`                  |
| `STRIPE_SECRET_KEY`             | Stripe secret key                   | `sk_test_...`             |
| `STRIPE_WEBHOOK_SECRET`         | Stripe webhook signing secret       | `whsec_...`               |
| `STRIPE_PRICE_ID_PRO`           | Stripe price ID for Pro plan        | `price_...`               |
| `STRIPE_API_VERSION`            | Pinned Stripe API version           | `2024-06-20`              |
| `NEXT_PUBLIC_APP_URL`           | App URL for redirects               | `http://localhost:3000`   |

### Optional

| Variable                  | Description               | When to Add              |
| ------------------------- | ------------------------- | ------------------------ |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics key     | Stage 5 (Analytics)      |
| `SENTRY_DSN`              | Sentry error tracking DSN | Stage 5 (Error tracking) |
| `RESEND_API_KEY`          | Resend email API key      | Stage 5 (Email)          |

---

## 8. Stripe API Version Pinning

Use this during Stage 4 (Stripe Billing) and when upgrading Stripe SDK.

```bash
# In .env.local
STRIPE_API_VERSION=2024-06-20
```

```typescript
// In Stripe client initialization
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: process.env.STRIPE_API_VERSION,
});
```

**Upgrade Process:**

1. Check [Stripe API changelog](https://stripe.com/docs/upgrades)
2. Update `STRIPE_API_VERSION` in `.env.local`
3. Test all Stripe integrations (Checkout, Portal, Webhooks)
4. Update webhook event handling if needed
5. Deploy

---

## 9. Optional Module Boundaries

Use this during Stage 5 (Optional Integrations).

### Available Modules

| Module          | Purpose                   | Schema Impact                                   |
| --------------- | ------------------------- | ----------------------------------------------- |
| `workspaces`    | Multi-tenant teams        | High (requires `workspaces` table, RLS rewrite) |
| `usage-billing` | Metered usage + invoices  | Medium (requires `usage_records` table)         |
| `storage`       | Supabase Storage wrappers | Low (no schema changes)                         |
| `email`         | Resend integration        | Low (no schema changes)                         |
| `analytics`     | PostHog client            | Low (no schema changes)                         |
| `ai`            | LLM API clients           | Low (no schema changes)                         |
| `jobs`          | Background jobs           | Medium (requires `jobs` table)                  |

### Module Contract

```typescript
// lib/modules/<module>/index.ts
export function init(): void;  // Register routes, hooks
export type { <ModuleType> };  // Export types
```

**Requirements:**

- Each module has its own migrations
- Modules do not modify core tables
- Modules can be removed without breaking core
- Modules are opt-in (not installed by default)

---

## 10. Git Checkpoints

Use this throughout all stages.

```bash
# Stage 1: Architecture plan
git add docs/implementation-plan.md docs/schema.md docs/decisions.md README.md CLAUDE.md
git commit -m "stage 1: architecture plan"

# Stage 2: Project foundation
git add .
git commit -m "stage 2: project foundation"

# Stage 3: Supabase authentication
git add .
git commit -m "stage 3: Supabase authentication"

# Stage 4: Stripe billing
git add .
git commit -m "stage 4: Stripe billing"

# Stage 5: Optional integrations
git add .
git commit -m "stage 5: optional integrations"

# Stage 6: Testing and documentation
git add .
git commit -m "stage 6: testing and documentation"

# Stage 7: Security review
git add .
git commit -m "stage 7: security review"

# Stage 8: Final validation
git add .
git commit -m "stage 8: final validation"
```

**Safer commit pattern:**

```bash
git diff --stat
git diff
npm run validate
git add .
git commit -m "Describe the completed stage"
```

---

## 11. When to Escalate to Perplexity Pro

Use this during any stage when uncertain.

**Escalate before returning to Claude Free when:**

- A Supabase SSR, cookie, or middleware error appears
- A Stripe webhook event name or field is uncertain
- RLS policies behave unexpectedly
- A test failure involves an external API contract
- A security question arises that Claude Free cannot reliably answer from code alone

**Perplexity Pro is your source of truth for:**

- Current external APIs (Supabase, Stripe, Vercel)
- Vendor documentation updates
- Security audit (Stage 7)

**Claude Free is your source of truth for:**

- The code you already have
- Implementation details within the approved architecture

---

## 12. Non-Goals (Explicitly Out of Scope)

Do not add these unless a concrete product requirement exists:

- Multi-tenant workspaces or teams
- Usage-based billing (metered events)
- File uploads (Supabase Storage)
- Email sending (Resend)
- Analytics (PostHog) or error tracking (Sentry)
- AI/LLM integrations
- Background job queues (separate service)
- Microservices or separate backend
- GraphQL, Redux, Prisma, Drizzle, Docker

---

**End of reference.**
