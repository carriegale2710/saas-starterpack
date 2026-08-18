# Architectural Decisions

## Decision Log

This document records key architectural decisions, trade-offs, and rejected alternatives for the SaaS starter repository.

---

## 1. Modular Monolith Architecture

**Decision:** Single Next.js repository with isolated vendor code

**Context:** Solo founders need to ship fast but maintain flexibility to scale or pivot.

**Alternatives Considered:**

| Alternative                        | Pros                                  | Cons                                        | Verdict                                  |
| ---------------------------------- | ------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| Microservices                      | Independent scaling, team parallelism | Operational complexity, deployment overhead | Rejected — premature optimization        |
| Separate backend (Express/FastAPI) | Clear API boundaries                  | Two repos to maintain, CORS complexity      | Rejected — Next.js API routes sufficient |
| Monorepo (Turborepo)               | Shared types, atomic commits          | Build complexity, overkill for solo founder | Rejected — add when team grows           |

**Trade-offs:**

- Fast iteration, single deployment
- Simple debugging (no distributed tracing needed)
- Vendor lock-in (Supabase, Stripe) mitigated by isolation
- Scaling limits (handled by Vercel/Supabase managed services)

**Consequences:**

- All code in one repo (`/app`, `/lib`, `/components`)
- Vendor-specific code isolated in `lib/vendor/supabase/`, `lib/vendor/stripe/`
- Optional modules in `lib/modules/*/` (opt-in, removable)

---

## 2. Supabase Over Self-Hosted PostgreSQL

**Decision:** Use Supabase managed PostgreSQL with RLS

**Context:** Solo founders cannot afford database administration time.

**Alternatives Considered:**

| Alternative                      | Pros                             | Cons                                      | Verdict                                |
| -------------------------------- | -------------------------------- | ----------------------------------------- | -------------------------------------- |
| Self-hosted PostgreSQL (EC2/RDS) | Full control, no vendor lock-in  | Requires DBA skills, backup management    | Rejected — high maintenance cost       |
| PlanetScale/Neon                 | Serverless, git-based migrations | Less mature RLS, smaller ecosystem        | Rejected — Supabase has Auth + Storage |
| Firebase Firestore               | No SQL, easy scaling             | No relational queries, expensive at scale | Rejected — need SQL for billing        |

**Trade-offs:**

- Zero database administration
- Built-in Auth, RLS, Storage, Realtime
- Generous free tier (500MB, 50K MAU)
- Vendor lock-in (mitigated by standard SQL)
- Cold starts on free tier (acceptable for MVP)

**Consequences:**

- Never expose service-role key to client
- All queries use RLS (user-scoped)
- Migrations via Supabase CLI

---

## 3. Stripe Webhooks as Source of Truth

**Decision:** Subscription state is updated **only** via Stripe webhooks, not client-side

**Context:** Billing state must be accurate and auditable; client-side updates are unreliable.

**Alternatives Considered:**

| Alternative                            | Pros                      | Cons                             | Verdict                             |
| -------------------------------------- | ------------------------- | -------------------------------- | ----------------------------------- |
| Client-side subscription updates       | Simpler, no webhook infra | Race conditions, security risks  | Rejected — untrustworthy            |
| Polling Stripe API                     | No webhook setup          | Rate limits, latency, cost       | Rejected — inefficient              |
| Hybrid (webhook + client confirmation) | Faster UX feedback        | Complexity, eventual consistency | Rejected — webhooks are fast enough |

**Trade-offs:**

- Single source of truth (Stripe)
- Audit trail (webhook_events table)
- Handles edge cases (failed payments, chargebacks)
- Webhook infrastructure complexity (solved by atomic claim pattern)
- Eventual consistency (typically <1s delay)

**Consequences:**

- `/api/stripe/webhook` is critical path
- `webhook_events` table tracks all events
- Entitlement checks read from `subscriptions` table (synced from webhooks)
- Unknown event types logged but not rejected

---

## 4. Atomic Webhook Claim Pattern (No Redis)

**Decision:** Use database row locking for webhook idempotency, not Redis

**Context:** Solo founders should minimize dependencies; Supabase PostgreSQL is already available.

**Alternatives Considered:**

| Alternative              | Pros                          | Cons                                         | Verdict                |
| ------------------------ | ----------------------------- | -------------------------------------------- | ---------------------- |
| Redis (Upstash)          | Fast, purpose-built for locks | Extra dependency, cost, operational overhead | Rejected — overkill    |
| In-memory lock (Node.js) | Simple, no infra              | Not distributed-safe, crashes lose state     | Rejected — unsafe      |
| Database row locking     | No new dependencies, durable  | Slightly slower than Redis                   | Accepted — good enough |

**Trade-offs:**

- No new dependencies
- Durable (survives crashes)
- Auditable (webhook_events table)
- Slightly slower than Redis (acceptable for webhooks)

**Consequences:**

- `webhook_events` table with `status` ENUM
- Atomic claim: `UPDATE ... WHERE status = 'pending' RETURNING id`
- Failed events retry with exponential backoff (optional cron)

---

## 5. shadcn/ui-Style Components (Not MUI/Chakra)

**Decision:** Copy-paste component system (shadcn/ui pattern), not component library

**Context:** Solo founders need customization without bundle bloat.

**Alternatives Considered:**

| Alternative                       | Pros                           | Cons                            | Verdict                   |
| --------------------------------- | ------------------------------ | ------------------------------- | ------------------------- |
| MUI/Chakra                        | Ready-to-use, accessible       | Large bundle, hard to customize | Rejected — bloat          |
| Tailwind UI                       | Good defaults, Tailwind-native | Paid, less flexible             | Rejected — cost           |
| Radix + Tailwind (shadcn pattern) | Full control, minimal bundle   | More setup initially            | Accepted — best long-term |

**Trade-offs:**

- Full customization (own the code)
- Minimal bundle (tree-shakeable)
- Accessible (Radix primitives)
- More initial setup (one-time cost)

**Consequences:**

- Components in `/components/ui/`
- Customizable via `components.json`
- No external component library dependency

---

## 6. Next.js App Router (Not Pages Router)

**Decision:** Use Next.js 14+ App Router with Server Components

**Context:** App Router is the future of Next.js; Pages Router is deprecated.

**Alternatives Considered:**

| Alternative  | Pros                    | Cons                               | Verdict                        |
| ------------ | ----------------------- | ---------------------------------- | ------------------------------ |
| Pages Router | Simpler, more tutorials | Deprecated, no Server Components   | Rejected — dead end            |
| Remix        | Great DX, nested routes | Smaller ecosystem, Vercel friction | Rejected — Vercel is preferred |

**Trade-offs:**

- Server Components by default (less client JS)
- Built-in loading/error states
- Layouts and nested routing
- Learning curve (new paradigm)
- Some libraries not yet compatible

**Consequences:**

- All routes in `/app/`
- Server Components by default (`'use client'` when needed)
- Middleware for auth checks

---

## 7. No ORM (Raw SQL + Supabase Client)

**Decision:** Use Supabase client directly, no Prisma/Drizzle

**Context:** Solo founders should minimize dependencies and maintenance.

**Alternatives Considered:**

| Alternative               | Pros                       | Cons                                    | Verdict                    |
| ------------------------- | -------------------------- | --------------------------------------- | -------------------------- |
| Prisma                    | Type-safe, migrations      | Heavy, slow cold starts, vendor lock-in | Rejected — overkill        |
| Drizzle                   | Lightweight, type-safe     | Still a dependency, learning curve      | Rejected — raw SQL is fine |
| Raw SQL + Supabase client | No ORM layer, full control | More boilerplate                        | Accepted — simple enough   |

**Trade-offs:**

- No ORM dependency
- Full SQL control (RLS, indexes, constraints)
- Supabase client is type-safe (generated types)
- More boilerplate (mitigated by helper functions)

**Consequences:**

- Queries use `supabase.from('table').select()`
- Types generated via `npx supabase gen types typescript`
- No migration tool (use Supabase CLI)

---

## 8. Environment Validation at Runtime

**Decision:** Fail-fast validation script on startup, not just TypeScript types

**Context:** Missing environment variables cause cryptic errors in production.

**Alternatives Considered:**

| Alternative           | Pros                               | Cons                    | Verdict                  |
| --------------------- | ---------------------------------- | ----------------------- | ------------------------ |
| TypeScript types only | Type safety                        | No runtime validation   | Rejected — insufficient  |
| Zod schema validation | Runtime validation, type inference | Extra dependency        | Accepted — worth it      |
| Manual checks         | No dependency                      | Repetitive, error-prone | Rejected — Zod is better |

**Trade-offs:**

- Catch errors before deployment
- Self-documenting (`.env.example`)
- Extra dependency (Zod — minimal, widely used)

**Consequences:**

- `lib/env.ts` with Zod schema
- Validation runs on `npm run dev` and `npm run build`
- Fails with clear error message

---

## 9. Minimal Dependencies Philosophy

**Decision:** Every dependency must justify its existence

**Context:** Dependency bloat increases maintenance cost and attack surface.

**Dependency Audit:**

| Dependency                 | Purpose         | Core/Optional | Maintenance Cost        | Simpler Alternative Rejected |
| -------------------------- | --------------- | ------------- | ----------------------- | ---------------------------- |
| `next`                     | Framework       | Core          | Low (Vercel-maintained) | N/A — required               |
| `react`                    | UI library      | Core          | Low                     | N/A — required               |
| `@supabase/supabase-js`    | Database client | Core          | Low                     | Raw fetch (too verbose)      |
| `@supabase/ssr`            | SSR helpers     | Core          | Low                     | Manual cookies (error-prone) |
| `stripe`                   | Billing SDK     | Core          | Low                     | Raw API calls (too verbose)  |
| `zod`                      | Validation      | Core          | Low                     | Manual checks (error-prone)  |
| `vitest`                   | Testing         | Core          | Low                     | Jest (heavier)               |
| `tailwindcss`              | Styling         | Core          | Low                     | Plain CSS (slower)           |
| `class-variance-authority` | Variant helpers | Core          | Low                     | Manual classes (verbose)     |
| `clsx` / `tailwind-merge`  | Class utilities | Core          | Low                     | Manual (error-prone)         |
| `lucide-react`             | Icons           | Core          | Low                     | SVG files (verbose)          |
| `posthog-js`               | Analytics       | Optional      | Low                     | N/A — opt-in                 |
| `@sentry/nextjs`           | Error tracking  | Optional      | Medium                  | N/A — opt-in                 |
| `resend`                   | Email sending   | Optional      | Low                     | N/A — opt-in                 |

**Rejected Dependencies:**

- `prisma` / `drizzle` — ORM not needed for simple schema
- `redux` / `zustand` — React Context + Server Components sufficient
- `redis` — Database row locking for webhooks
- `docker` — Vercel deployment is simpler
- `graphql` / `apollo` — REST API routes sufficient

---

## 10. Optional Module Boundaries

**Decision:** Optional features are isolated in `lib/modules/*/` with clear interfaces

**Context:** Solo founders may need to add features later without breaking core.

**Module Contract:**

```typescript
// lib/modules/workspaces/index.ts
export function init(): void; // Register routes, hooks
export type { Workspace }; // Export types
```

**Trade-offs:**

- Core remains minimal
- Modules can be removed without breaking core
- Slight duplication (module-specific helpers)

**Consequences:**

- Each module has its own migrations
- Modules do not modify core tables
- Modules are opt-in (not installed by default)

---

## 11. Security Boundaries

**Decision:** Never expose Supabase service-role key; RLS is mandatory

**Context:** Service-role key bypasses all security; exposure is catastrophic.

**Alternatives Considered:**

| Alternative                    | Pros            | Cons                           | Verdict                      |
| ------------------------------ | --------------- | ------------------------------ | ---------------------------- |
| Service-role key in client     | Simpler queries | Catastrophic if leaked         | Rejected — never             |
| Custom backend for all queries | Full control    | More code to maintain          | Rejected — RLS is sufficient |
| RLS + anon key                 | Secure, simple  | Requires careful policy design | Accepted — best practice     |

**Trade-offs:**

- Secure by default
- No custom backend needed
- RLS policies must be tested thoroughly

**Consequences:**

- Service-role key only in `/api/stripe/webhook` (server-side)
- All client queries use anon key + RLS
- RLS policies tested with multiple users

---

## 12. Stripe API Version Pinning

**Decision:** Pin Stripe API version in environment, upgrade explicitly

**Context:** Stripe updates API versions quarterly; breaking changes cause production failures.

**Alternatives Considered:**

| Alternative                 | Pros                      | Cons                             | Verdict                  |
| --------------------------- | ------------------------- | -------------------------------- | ------------------------ |
| Latest version (no pinning) | Always up-to-date         | Breaking changes without warning | Rejected — unsafe        |
| Pin in code                 | Explicit                  | Harder to upgrade                | Rejected — env is better |
| Pin in environment          | Easy to upgrade, explicit | None                             | Accepted — best practice |

**Trade-offs:**

- Explicit version control
- Easy to upgrade (change env var)
- Audit trail (git history)

**Consequences:**

- `STRIPE_API_VERSION=2024-06-20` in `.env`
- Stripe SDK initialized with version
- Upgrade process documented in README

---

## Risks & Mitigations

| Risk                      | Likelihood | Impact | Mitigation                             |
| ------------------------- | ---------- | ------ | -------------------------------------- |
| Webhook race conditions   | Medium     | High   | Atomic claim pattern, idempotency keys |
| RLS misconfiguration      | Low        | High   | Test policies, deny-by-default         |
| Stripe API version drift  | Medium     | Medium | Pin version, document upgrade path     |
| Vendor lock-in (Supabase) | High       | Medium | Standard SQL, exportable data          |
| Vercel cold starts        | Medium     | Low    | Pro tier, optimize bundle size         |

---

## Non-Goals (Explicitly Out of Scope)

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

## Implementation Sequence

1. **Phase 1:** Foundation (Next.js, Supabase, Auth)
2. **Phase 2:** Billing (Stripe, webhooks, entitlements)
3. **Phase 3:** Polish (testing, docs, deployment)

Each phase has acceptance gates (see `implementation-plan.md`).

---

## Decisions Requiring Approval

Before proceeding, please confirm:

1. **Database schema:** Are the `profiles`, `subscriptions`, and `webhook_events` tables sufficient for your use cases? Any missing fields?

2. **Webhook pattern:** Is the atomic claim pattern (DB-based, no Redis) acceptable, or do you prefer Redis for performance?

3. **Optional modules:** Which optional modules do you anticipate needing in the next 6 months? (workspaces, usage-billing, storage, email, analytics, AI)

4. **Testing strategy:** Is Vitest + 70% coverage target appropriate, or do you prefer a different testing framework/coverage goal?

5. **Deployment:** Is Vercel + Supabase your preferred stack, or do you have alternative hosting requirements (AWS, self-hosted)?
