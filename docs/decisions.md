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

**Template default:** `BILLING_CONFIG.pastDueGracePeriod = false` in `lib/config.ts` — deny access immediately on `past_due`. This is a **product decision**; change it consciously. See `docs/schema.md` Entitlement Logic for the full status table.

**Entitlement-controlling events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. See `docs/schema.md` for the full event table.

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
- **Canonical event list and INSERT pattern:** see `docs/schema.md` — Atomic Webhook Processing
- **Stale recovery query:** see `README.md` — Webhook Atomicity & Stale-Processing Recovery

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
- Next.js 15 is the current version
- `params`, `searchParams`, `cookies()`, and `headers()` are async — always `await` them
- `fetch()` and GET Route Handlers are uncached by default — opt in with `cache: 'force-cache'`
- Turbopack is the default dev bundler (`next dev` uses Turbopack)
- Target Node.js 22 LTS; Node.js 20 is deprecated on Vercel from October 2026

---

## 7. No ORM (Raw SQL + Supabase Client)

**Decision:** Use Supabase client directly, no Prisma/Drizzle

**Consequences:**

- Queries use `supabase.from('table').select()`
- Types generated via `npx supabase gen types typescript`
- No migration tool (use Supabase CLI)
- Use Node.js 22 LTS (`engines.node: ">=22.0.0"` in `package.json`)
- `create-next-app@latest` without `--src-dir` generates root-level `app/`, `lib/`, `components/` — do not pass `--src-dir`

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

## 13. Known Audit Flags (Stage 2 — reviewed 2026-08-19)

**Baseline: `next@15.5.23` — latest stable 15.x. `npm audit fix --force` must not be run as it would silently upgrade to `next@16.3.1` (breaking major).**

| Flag | npm severity | Actual exploitability in this project | Action |
|---|---|---|---|
| `postcss` ≤8.5.22 — XSS via unescaped `</style>` (GHSA-qx2v-qp2m-jg93) | High | **Not exploitable.** Advisory states: *"Impact non-bundler use cases since bundlers protect against XSS on their own."* Next.js uses PostCSS as a build-time CSS processor — it never parses user-submitted CSS and re-embeds it in `<style>` tags at runtime. The attack requires exactly that pattern. | No action needed. Reassess if a feature ever re-stringifies user CSS into HTML. |
| `postcss` — source map path traversal (GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849) | High | Build-tool only. PostCSS source maps are generated during `npm run build` from your own source files, not from attacker-controlled input. No user input reaches PostCSS in this architecture. | No action needed for this use case. |
| `sharp` <0.35.0 — libvips CVE-2026-33327/33328/35590/35591 | High | Bundled inside `next@15.x` for image optimisation. Risk applies only if serving attacker-controlled images through `next/image`. This project does not do that at Stage 2. | Reassess at Stage 7 if `next/image` is used with user-uploaded images. Otherwise low risk. |
| `esbuild` ≤0.24.2 — dev server request interception | Moderate | **Dev-only.** Only affects `npm run dev` via Vitest's vite internals. Not present in production builds. | Fix at Stage 6: `npm install --save-dev vitest@^4.0.0 @vitest/coverage-v8@^4.0.0` |

**Next review point:** Stage 7 (Security Review).

---

## 14. Nav Links in `lib/config.ts` (Not Hardcoded in Components)

**Decision:** Export `MARKETING_NAV` and `DASHBOARD_NAV` from `lib/config.ts` as typed arrays; components consume them via `.map()`

**Context:** During Stage 3 build, `marketing-nav.tsx` and `dashboard-nav.tsx` both imported nav link arrays from `lib/config.ts`. The config file was rewritten during Stage 3 and both exports were accidentally dropped, causing runtime crashes (`Cannot read properties of undefined (reading 'map')`).

**Alternatives Considered:**

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| Hardcode links in each nav component | Simple | Duplicated, drift-prone | Rejected |
| Separate `lib/nav.ts` file | Clean separation | Extra file for small data | Rejected — `lib/config.ts` is already the central config |
| `lib/config.ts` exports | Single source of truth, testable | Must not be dropped in rewrites | Accepted |

**Consequences:**

- `MARKETING_NAV` and `DASHBOARD_NAV` are typed `{ label: string; href: string }[]`
- Both exported from `lib/config.ts` alongside `APP_CONFIG` and `BILLING_CONFIG`
- Covered by `tests/config.test.ts` (shape) and `tests/nav.test.ts` (uniqueness, group isolation)
- **Rule:** any rewrite of `lib/config.ts` must preserve these exports or update all importing components atomically

---

## 15. Vitest Environment Setup File for Env Var Stubs

**Decision:** Use `tests/setup.ts` + `vitest.config.ts` `setupFiles` to stub required env vars before any test module is imported

**Context:** `lib/env.ts` calls `envSchema.parse(process.env)` at module load time (top-level, not inside a function). Vitest does not load `.env.local`, so any test file that directly or transitively imports `lib/config.ts` (which imports `lib/env.ts`) would crash with a `ZodError` before a single test ran. This affected `tests/config.test.ts`, `tests/entitlements.test.ts`, and `tests/nav.test.ts`.

**Alternatives Considered:**

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| `dotenv` in vitest config | Loads real `.env.local` | Real secrets in test env; `.env.local` not committed | Rejected |
| Mock `lib/env.ts` module per test | Isolated | Boilerplate in every test file | Rejected |
| Lazy-evaluate `env` (move parse inside function) | No startup crash | Changes production behaviour; env errors surface later | Rejected |
| `tests/setup.ts` with `process.env` stubs | One file, zero test-file boilerplate, no real secrets | Stubs must be kept in sync with `lib/env.ts` schema | Accepted |

**Consequences:**

- `tests/setup.ts` sets all 4 required env vars to safe non-functional placeholder values
- `vitest.config.ts` sets `setupFiles: ['./tests/setup.ts']` — runs before every test file
- `tests/setup.ts` must be updated whenever `lib/env.ts` adds a new required variable
- Never put real API keys or secrets in `tests/setup.ts`

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
| Nav config dropped in rewrite | Low    | High   | Covered by `tests/config.test.ts` + `tests/nav.test.ts` |

---

## Non-Goals (Explicitly Out of Scope)

- Background job queues (separate service)
- Microservices or separate backend
- GraphQL, Redux, Prisma, Drizzle, Docker

---

## Implementation Sequence

1. **Phase 1:** Foundation (Next.js, Supabase, Auth) ✅
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
