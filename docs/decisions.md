# Architectural Decision Log

Key architectural decisions, trade-offs, and rejected alternatives for the SaaS starter repo.

## Table of Contents

1. [Modular Monolith Architecture](#1-modular-monolith-architecture)
2. [Supabase Over Self-Hosted PostgreSQL](#2-supabase-over-self-hosted-postgresql)
3. [Stripe Webhooks as Source of Truth](#3-stripe-webhooks-as-source-of-truth)
4. [Atomic Webhook Claim Pattern (No Redis)](#4-atomic-webhook-claim-pattern-no-redis)
5. [shadcn/ui-Style Components (Not MUI/Chakra)](#5-shadcnui-style-components-not-muichakra)
6. [Next.js App Router (Not Pages Router)](#6-nextjs-app-router-not-pages-router)
7. [No ORM (Raw SQL + Supabase Client)](#7-no-orm-raw-sql--supabase-client)
8. [Environment Validation at Runtime](#8-environment-validation-at-runtime)
9. [npm as Package Manager](#9-npm-as-package-manager)
10. [Optional Module Boundaries](#10-optional-module-boundaries)
11. [Security Boundaries](#11-security-boundaries)
12. [Stripe SDK & API Version Pinning](#12-stripe-sdk--api-version-pinning)
13. [Known Audit Flags (Stage 2)](#13-known-audit-flags-stage-2-reviewed-2026-08-19)
14. [Nav Links in `lib/config.ts`](#14-nav-links-in-libconfigts-not-hardcoded)
15. [Vitest Setup File for Env Var Stubs](#15-vitest-setup-file-for-env-var-stubs)
16. [Stripe `current_period_start/end` Breaking Change](#16-stripe-current_period_startend-breaking-change-sdk-v18--api-basil)
17. [AI Toolchain: Perplexity Pro + Claude Sonnet 5 + GitHub MCP](#17-ai-toolchain-perplexity-pro--claude-sonnet-5--github-mcp)
18. [Layered Documentation Strategy](#18-layered-documentation-strategy)
19. [Risks & Mitigations](#risks--mitigations)
20. [Non-Goals](#non-goals-explicitly-out-of-scope)
21. [Implementation Sequence](#implementation-sequence)
22. [Decisions Requiring Approval](#decisions-requiring-approval)

---

## 1. Modular Monolith Architecture

**Decision:** Single Next.js repo; vendor code isolated.

**Rejected:** Microservices (premature complexity), separate backend (Next.js API routes suffice), Turborepo monorepo (overkill for a solo founder — revisit when the team grows).

- All code in one repo (`/app`, `/lib`, `/components`)
- `lib/` is canonical — never `src/lib/`
- Vendor code isolated in `lib/vendor/supabase/`, `lib/vendor/stripe/`
- Optional modules in `lib/modules/*/` (opt-in, removable)

---

## 2. Supabase Over Self-Hosted PostgreSQL

**Decision:** Managed Supabase PostgreSQL with RLS.

- Never expose the service-role key to the client
- Client queries use the anon key + RLS
- Migrations via Supabase CLI

---

## 3. Stripe Webhooks as Source of Truth

**Decision:** Subscription state updates only via Stripe webhooks, never client-side.

- `/api/stripe/webhook` is the critical path
- `webhook_events` table tracks all events (canonical name — never `stripe_events`)
- Entitlements read from `subscriptions` table (synced from webhooks)
- Unknown event types are logged, not rejected

**`past_due` policy:** Default is **deny access immediately** (`BILLING_CONFIG.pastDueGracePeriod = false` in `lib/config.ts`). A grace period is only worth choosing if interruption is unacceptable (e.g. team tools) — change this consciously. Full status table: `docs/schema.md`.

**Entitlement-controlling events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

---

## 4. Atomic Webhook Claim Pattern (No Redis)

**Decision:** Database row locking for webhook idempotency instead of Redis — no new dependency, durable, auditable, slightly slower (acceptable for webhooks).

- `webhook_events` table with a `status` ENUM
- Atomic claim: `UPDATE ... WHERE status = 'pending' RETURNING id`
- The subscription upsert and `status = 'processed'` update share one transaction, so a crash can't leave a misleading `processing` row — recovered via a timeout-based stale-processing reset (see README)
- Failed events retry with exponential backoff (optional cron)
- Canonical event list, INSERT pattern, and stale-recovery query: `docs/schema.md`

---

## 5. shadcn/ui-Style Components (Not MUI/Chakra)

**Decision:** Copy-paste component system, not a library dependency.

- Components in `/components/ui/`, customizable via `components.json`

---

## 6. Next.js App Router (Not Pages Router)

**Decision:** Next.js 14+ App Router with Server Components.

- Routes in `/app/`; Server Components by default (`'use client'` when needed)
- Middleware handles auth checks
- Next.js 15 is current; `params`, `searchParams`, `cookies()`, `headers()` are async — always `await`
- `fetch()` and GET Route Handlers are uncached by default — opt in with `cache: 'force-cache'`
- Turbopack is the default dev bundler
- Target Node.js 22 LTS (Node 20 deprecated on Vercel from Oct 2026)

---

## 7. No ORM (Raw SQL + Supabase Client)

**Decision:** Use the Supabase client directly — no Prisma/Drizzle.

- Queries: `supabase.from('table').select()`
- Types via `npx supabase gen types typescript`
- No migration tool — use Supabase CLI
- `engines.node: ">=22.0.0"` in `package.json`
- Use `create-next-app@latest` **without** `--src-dir`

---

## 8. Environment Validation at Runtime

**Decision:** Fail-fast Zod validation on startup.

- `lib/env.ts` validates via a Zod schema; runs on `npm run dev`/`build`; fails with a clear error message

---

## 9. npm as Package Manager

**Decision:** npm — pre-installed, standard lockfile, no extra setup needed for a solo founder.

- All commands via `npm install/run/test`; lockfile is `package-lock.json`; CI uses `npm ci`
- Do not commit `pnpm-lock.yaml` or a pnpm-targeted `.npmrc`

---

## 10. Optional Module Boundaries

**Decision:** Optional features live in `lib/modules/*/` with clear interfaces. Full contract: [`docs/guides/adding-a-module.md`](./guides/adding-a-module.md).

- Each module owns its own migrations; most don't touch core tables
- **Exception:** `workspaces` and `usage-billing` do touch core schema (workspace-membership table, billing-owner column) — must document changes in their own `migrations/` folder and be reviewed before activation
- Modules are opt-in, not installed by default

---

## 11. Security Boundaries

**Decision:** Never expose the Supabase service-role key; RLS is mandatory.

- Service-role key is used only server-side, in `/api/stripe/webhook`
- The service-role key bypasses RLS unconditionally (Supabase platform behavior) — don't add `auth.uid() IS NULL` policies to simulate this; it's misleading and risks unintended gaps
- Client queries use the anon key + RLS
- Privileged tables (e.g. `webhook_events`) have no authenticated-user policies — absence of a matching policy denies access
- RLS policies are tested with multiple users

---

## 12. Stripe SDK & API Version Pinning

**Decision:** Pin `stripe@17` and API version `2025-11-20.acacia`; upgrade both together, deliberately.

**Why:** `stripe@18+` (API `2025-03-31.basil`+) has a breaking schema change (see #16); `stripe@17` predates it. (`.env.example` previously stubbed an outdated `2024-06-20` — corrected.)

- `package.json`: `"stripe": "17.x"`; `.env`/`.env.example`: `STRIPE_API_VERSION=2025-11-20.acacia`
- `lib/env.ts` validates `STRIPE_API_VERSION` as a non-empty string
- Upgrade process: bump both together, run the full test suite, check #16 compatibility, then deploy

---

## 13. Known Audit Flags (Stage 2, reviewed 2026-08-19)

Baseline `next@15.5.23`. **Do not run `npm audit fix --force`** — it would silently jump to `next@16.3.1` (breaking major).

| Flag                                               | Severity | Why it's not exploitable here                                                                        | Action                                                        |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `postcss` XSS via `</style>` (GHSA-qx2v-qp2m-jg93) | High     | Build-time only; no user CSS is re-embedded at runtime                                               | None — reassess if that changes                               |
| `postcss` source-map path traversal                | High     | Build-tool only; maps are generated from our own source, not attacker input                          | None                                                          |
| `sharp` libvips CVEs                               | High     | Bundled in Next's image optimization; we don't yet serve attacker-controlled images via `next/image` | Reassess at Stage 7 if that changes                           |
| `esbuild` dev-server interception                  | Moderate | Dev-only, via Vitest/vite; not present in production builds                                          | Fix at Stage 6: `vitest@^4.0.0`, `@vitest/coverage-v8@^4.0.0` |

Next review: Stage 7 (Security Review).

---

## 14. Nav Links in `lib/config.ts` (Not Hardcoded)

**Decision:** Export `MARKETING_NAV` / `DASHBOARD_NAV` as typed arrays from `lib/config.ts`; components consume them via `.map()`.

**Why:** During Stage 3, a config rewrite accidentally dropped both exports, crashing both nav components.

- Typed as `{ label: string; href: string }[]`, alongside `APP_CONFIG` and `BILLING_CONFIG`
- Covered by `tests/config.test.ts` (shape) and `tests/nav.test.ts` (uniqueness, group isolation)
- **Rule:** any rewrite of `lib/config.ts` must preserve these exports or update all importers atomically

---

## 15. Vitest Setup File for Env Var Stubs

**Decision:** `tests/setup.ts` + `vitest.config.ts`'s `setupFiles` stub required env vars before any test module loads.

**Why:** `lib/env.ts` parses `process.env` at module load time; Vitest doesn't load `.env.local`, so any test importing `lib/config.ts` would crash with a `ZodError` before running.

- Stubs all 4 required vars with safe placeholder values — never real secrets
- Must be kept in sync whenever `lib/env.ts` adds a required variable

---

## 16. Stripe `current_period_start/end` Breaking Change (SDK v18 / API basil)

**Decision:** Don't upgrade to `stripe@18` / API `2025-03-31.basil`+ until the DB schema and webhook handler read period dates from `items.data[0]`.

**Why:** Basil removes `current_period_start`/`current_period_end` from the top-level subscription object; they move to `subscription.items.data[0]`. Our `subscriptions` table and webhook handler (`lib/vendor/stripe/webhook.ts`) still read the old top-level fields — upgrading without changes would silently write `null`/`undefined` on every renewal.

**Upgrade path:**

1. Update `lib/vendor/stripe/webhook.ts` to read from `items.data[0]`
2. Update `lib/database.types.ts` if column semantics change
3. Update `tests/fixtures/webhook-events.ts`
4. Bump `stripe` to `18.x` in `package.json`
5. Update `STRIPE_API_VERSION` to `2025-03-31.acacia`+ in `.env`/`.env.example`
6. Run `npm test` — all webhook tests must pass before deploying

`stripe@17` stays pinned until this migration happens. The TS compile error that surfaces on upgrade (missing `current_period_start`) is the reminder — don't suppress it with `as any`; fix the handler.

---

## 17. AI Toolchain: Perplexity Pro + Claude Sonnet 5 + GitHub MCP

**Decision:** Perplexity Pro (with Claude Sonnet 5 selected) for research/orchestration; GitHub MCP for all repo writes; Supabase MCP for DB introspection.

**Why Claude:** Reliable multi-step, constraint-holding instruction-following across a 50K+ token doc set (`CLAUDE.md`, `implementation-plan.md`, `decisions.md`, `prompt-plan.md`) — fits within Sonnet 5's 1M context. GPT-5/4.1 and Gemini 2.5 Flash were considered and rejected for weaker multi-step constraint-holding. Sonnet 4.6 is the fallback if Sonnet 5 is unavailable. Claude Code (local agent) is deferred to Stage 5+ pending cost.

See [`docs/toolchain.md`](./toolchain.md) for the session startup checklist.

- Always select **Claude Sonnet 5** in Perplexity Pro (fallback: Sonnet 4.6, no workflow changes needed)
- GitHub MCP handles all commits — Perplexity Pro never commits directly
- Supabase MCP used for schema/RLS checks between stages
- Reassess at Stage 5 if Claude Code becomes cost-effective

---

## 18. Layered Documentation Strategy

**Decision:** Single-ownership doc layers, linked not copied: `AGENTS.md` (orientation) → `CLAUDE.md` (rules) → `docs/architecture.md` (flows) → `docs/schema.md` (data) → `docs/decisions.md` (rationale).

**Why:** Key content (entitlement events, stale-processing SQL, RLS explanation, module contract) had drifted out of sync across 3–4 files; a DRY audit found 6 high-priority and 4 medium-priority duplications. Wrong docs hurt agent output more than missing docs.

| File                   | Owns                                                   | Doesn't own                            |
| ---------------------- | ------------------------------------------------------ | -------------------------------------- |
| `AGENTS.md`            | Stack, commands, directory map, constraint summary     | Rules, rationale, schema detail        |
| `CLAUDE.md`            | Implementation rules, security, naming, test strategy  | Version numbers, rationale, schema SQL |
| `docs/architecture.md` | System diagram, request flows                          | Status tables, SQL, rationale          |
| `docs/schema.md`       | Full SQL, RLS policies, entitlement table, webhook SQL | Rules, rationale                       |
| `docs/decisions.md`    | Rationale, alternatives, consequences                  | Rules, SQL, diagrams                   |
| `docs/guides/*`        | Task how-tos                                           | Architectural rules                    |

- Move content once, link from elsewhere — never copy
- `docs/guides/ai-agent-tips.md` covers the practical application of this for agents
- `AGENTS.md`'s constraints section is a summary with links, not a copy
- Re-run the DRY audit after major structural changes ("audit documentation for DRYness")
- Fix factual doc bugs immediately when found

---

## Risks & Mitigations

| Risk                          | Likelihood | Impact | Mitigation                                              |
| ----------------------------- | ---------- | ------ | ------------------------------------------------------- |
| Webhook race conditions       | Medium     | High   | Atomic claim pattern, transaction boundary              |
| Stale processing rows         | Low        | Medium | `updated_at` timeout recovery query                     |
| RLS misconfiguration          | Low        | High   | Tested policies, deny-by-default, no ambiguous policies |
| Stripe API version drift      | Medium     | Medium | Pinned SDK + API version (#12), upgrade checklist (#16) |
| Stripe basil upgrade          | Low        | High   | #16 upgrade path; TS types surface the error naturally  |
| Vendor lock-in (Supabase)     | High       | Medium | Standard SQL, exportable data                           |
| Vercel cold starts            | Medium     | Low    | Pro tier, optimized bundle size                         |
| Nav config dropped in rewrite | Low        | High   | `tests/config.test.ts` + `tests/nav.test.ts`            |
| AI model regression           | Low        | Medium | #17 fallback: Sonnet 4.6; reassess at Stage 5           |
| Doc drift / duplication       | Medium     | Medium | #18 single-ownership principle; periodic DRY audit      |

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

Each phase has acceptance gates — see `implementation-plan.md`.
