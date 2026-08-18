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

**Consequences:**

- All code in one repo (`/app`, `/lib`, `/components`)
- `lib/` is the canonical path — never `src/lib/`
- Vendor-specific code isolated in `lib/vendor/supabase/`, `lib/vendor/stripe/`
- Optional modules in `lib/modules/*/` (opt-in, removable)

---

## 2. Supabase Over Self-Hosted PostgreSQL

**Decision:** Use Supabase managed PostgreSQL with RLS

**Consequences:**

- Never expose service-role key to client
- All client queries use anon key + RLS
- Migrations via Supabase CLI

---

## 3. Stripe Webhooks as Source of Truth

**Decision:** Subscription state is updated **only** via Stripe webhooks, not client-side

**Consequences:**

- `/api/stripe/webhook` is critical path
- `webhook_events` table tracks all events (canonical name — never `stripe_events`)
- Entitlement checks read from `subscriptions` table (synced from webhooks)
- Unknown event types logged but not rejected

**`past_due` entitlement policy:**

The `past_due` status represents a payment that is failing but not yet definitively resolved. The product must make an explicit choice:

| Option                | Behaviour                                                 | When to choose                                                |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| Deny access (default) | User loses access immediately on `invoice.payment_failed` | Safest; simplest; correct for most products                   |
| Grace period          | User retains limited or full access while Stripe retries  | Only if users cannot afford an interruption (e.g. team tools) |

**Template default:** deny access (`BILLING_CONFIG.pastDueGracePeriod = false` in `lib/config.ts`). This is a **product decision** — change it consciously, not by accident.

---

## 4. Atomic Webhook Claim Pattern (No Redis)

**Decision:** Use database row locking for webhook idempotency, not Redis

**Trade-offs:**

- No new dependencies
- Durable (survives crashes)
- Auditable (`webhook_events` table)
- Slightly slower than Redis (acceptable for webhooks)

**Consequences:**

- `webhook_events` table with `status` ENUM
- Atomic claim: `UPDATE ... WHERE status = 'pending' RETURNING id`
- **Transaction boundary:** the subscription upsert and `status = 'processed'` update execute in the same database transaction. A crash cannot leave a permanently misleading `processing` row — the transaction rolls back and the event is recovered by a stale-processing reset (timeout-based, see README)
- Failed events retry with exponential backoff (optional cron)

---

## 5. shadcn/ui-Style Components (Not MUI/Chakra)

**Decision:** Copy-paste component system (shadcn/ui pattern), not component library

**Consequences:**

- Components in `/components/ui/`
- Customizable via `components.json`
- No external component library dependency

---

## 6. Next.js App Router (Not Pages Router)

**Decision:** Use Next.js 14+ App Router with Server Components

**Consequences:**

- All routes in `/app/`
- Server Components by default (`'use client'` when needed)
- Middleware for auth checks

---

## 7. No ORM (Raw SQL + Supabase Client)

**Decision:** Use Supabase client directly, no Prisma/Drizzle

**Consequences:**

- Queries use `supabase.from('table').select()`
- Types generated via `npx supabase gen types typescript`
- No migration tool (use Supabase CLI)

---

## 8. Environment Validation at Runtime

**Decision:** Fail-fast validation script on startup using Zod

**Consequences:**

- `lib/env.ts` with Zod schema
- Validation runs on `npm run dev` and `npm run build`
- Fails with clear error message

---

## 9. npm as Package Manager

**Decision:** Use npm (pre-installed with Node.js)

**Context:** npm requires no additional installation, generates a `package-lock.json` compatible with all CI environments, and is sufficient for a solo-founder project. pnpm would introduce an extra installation step and an unfamiliar lockfile format.

**Consequences:**

- All commands use `npm install`, `npm run dev`, `npm run build`, `npm test`
- Lockfile is `package-lock.json`
- CI installs via `npm ci`
- Do not commit a `pnpm-lock.yaml` or `.npmrc` targeting pnpm

---

## 10. Optional Module Boundaries

**Decision:** Optional features are isolated in `lib/modules/*/` with clear interfaces

**Module Contract:**

```typescript
// lib/modules/<module>/index.ts
export function init(): void;
export type { <ModuleType> };
```

**Consequences:**

- Each module has its own database migrations
- Most modules do not modify core tables
- **Exception:** `workspaces` and `usage-billing` are not schema-neutral. Workspaces requires a `workspaces` table and a workspace-membership relationship. Usage-billing may require a billing-owner column on `subscriptions`. These modules must document their schema changes in their own `migrations/` folder, and their core-table impacts must be reviewed before activation.
- Modules are opt-in (not installed by default)

---

## 11. Security Boundaries

**Decision:** Never expose Supabase service-role key; RLS is mandatory

**Consequences:**

- Service-role key used only in `/api/stripe/webhook` (server-side)
- **The service-role key bypasses RLS unconditionally** — this is a Supabase platform behaviour. No policy is needed (or correct) to grant service-role access. Do not add `auth.uid() IS NULL` policies to simulate service-role access; they are misleading and may open unintended gaps.
- All client queries use anon key + RLS
- Privileged tables (e.g. `webhook_events`) have no authenticated-user policies — the absence of a matching policy denies access
- RLS policies tested with multiple users

---

## 12. Stripe SDK & API Version Pinning

**Decision:** Pin both the Stripe Node SDK version in `package.json` and the API version string in `.env.local`; upgrade them together deliberately

**Context:** The Stripe Node SDK version and the API version string are separate but coupled. A mismatch can cause type errors or runtime failures on webhook events. Both must be tested together before deploying.

**Alternatives Considered:**

| Alternative                 | Pros               | Cons                             | Verdict                 |
| --------------------------- | ------------------ | -------------------------------- | ----------------------- |
| Latest version (no pinning) | Always up-to-date  | Breaking changes without warning | Rejected — unsafe       |
| Pin API version in env only | Easy env change    | SDK type mismatch on upgrade     | Rejected — insufficient |
| Pin SDK + API version both  | Explicit, testable | Requires deliberate upgrade step | Accepted — correct      |

**Consequences:**

- `package.json`: `"stripe": "16.x"` (or current stable major)
- `.env.local`: `STRIPE_API_VERSION=2024-06-20`
- Stripe SDK initialized with the validated env value
- Upgrade process: update both, run full test suite, then deploy

---

## Risks & Mitigations

| Risk                      | Likelihood | Impact | Mitigation                                            |
| ------------------------- | ---------- | ------ | ----------------------------------------------------- |
| Webhook race conditions   | Medium     | High   | Atomic claim pattern, transaction boundary            |
| Stale processing rows     | Low        | Medium | updated_at timeout recovery query                     |
| RLS misconfiguration      | Low        | High   | Test policies, deny-by-default, no ambiguous policies |
| Stripe API version drift  | Medium     | Medium | Pin SDK + API version, test on upgrade                |
| Vendor lock-in (Supabase) | High       | Medium | Standard SQL, exportable data                         |
| Vercel cold starts        | Medium     | Low    | Pro tier, optimize bundle size                        |

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

1. **Phase 1:** Foundation (Next.js, Supabase, Auth) — includes generating `0001_initial.sql`
2. **Phase 2:** Billing (Stripe, webhooks, entitlements)
3. **Phase 3:** Polish (testing, docs, deployment)

Each phase has acceptance gates (see `implementation-plan.md`).

---

## Decisions Requiring Approval

1. **Database schema:** Are `profiles`, `subscriptions`, and `webhook_events` sufficient?
2. **Webhook pattern:** Is the atomic DB-based claim (no Redis) acceptable?
3. **Optional modules:** Which modules do you need in the next 6 months?
4. **Testing strategy:** Is Vitest + 70% coverage appropriate?
5. **Deployment:** Is Vercel + Supabase your preferred stack?
