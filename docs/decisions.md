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
- **Stale recovery query:** see `docs/schema.md` — Atomic Webhook Processing

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

**Module Contract:** see [`docs/guides/adding-a-module.md`](./guides/adding-a-module.md) for the full scaffold steps and interface requirements.

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

**Decision:** Pin `stripe@17` in `package.json` and API version `2025-11-20.acacia` in `.env`; upgrade them together deliberately.

**Context (verified 2026-08-19 via Perplexity):**
The Stripe Node SDK version and the API version string are separate but coupled. As of August 2026:

- **npm latest: `stripe@17.x`** (maps to Stripe API `2026-01-28`)
- **`stripe@18.x`** introduced a **breaking schema change** in API `2025-03-31.basil` — see Decision #16
- **`stripe@17.x`** is safe; it uses APIs prior to the basil breaking change
- We use `STRIPE_API_VERSION=2025-11-20.acacia` — the latest stable version before basil

> ⚠️ The `.env.example` previously stubbed `2024-06-20`. This was outdated and has been corrected to `2025-11-20.acacia`.

**Alternatives Considered:**

| Alternative                  | Pros               | Cons                                         | Verdict                 |
| ---------------------------- | ------------------ | -------------------------------------------- | ----------------------- |
| `stripe@latest` (no pinning) | Always up-to-date  | v18+ breaks `current_period_start/end` field | Rejected — data loss    |
| `stripe@18+`                 | Latest features    | Breaks DB schema (see Decision #16)          | Rejected — incompatible |
| `stripe@17` + pinned API     | Explicit, testable | Requires deliberate upgrade step             | **Accepted**            |

**Consequences:**

- `package.json`: `"stripe": "17.x"`
- `.env` / `.env.example`: `STRIPE_API_VERSION=2025-11-20.acacia`
- `lib/env.ts`: `STRIPE_API_VERSION` validated as `z.string().min(1)`
- Stripe client initialised with `apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion`
- **Upgrade process:** update both `package.json` version and `STRIPE_API_VERSION` together, run full test suite, check Decision #16 compatibility, then deploy
- Next safe review point: when upgrading to `stripe@18` — read Decision #16 first

---

## 13. Known Audit Flags (Stage 2 — reviewed 2026-08-19)

**Baseline: `next@15.5.23` — latest stable 15.x. `npm audit fix --force` must not be run as it would silently upgrade to `next@16.3.1` (breaking major).**

| Flag                                                                                                  | npm severity | Actual exploitability in this project                                                                                                                                                                                                                                                                    | Action                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `postcss` ≤8.5.22 — XSS via unescaped `</style>` (GHSA-qx2v-qp2m-jg93)                                | High         | **Not exploitable.** Advisory states: _"Impact non-bundler use cases since bundlers protect against XSS on their own."_ Next.js uses PostCSS as a build-time CSS processor — it never parses user-submitted CSS and re-embeds it in `<style>` tags at runtime. The attack requires exactly that pattern. | No action needed. Reassess if a feature ever re-stringifies user CSS into HTML.            |
| `postcss` — source map path traversal (GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849) | High         | Build-tool only. PostCSS source maps are generated during `npm run build` from your own source files, not from attacker-controlled input. No user input reaches PostCSS in this architecture.                                                                                                            | No action needed for this use case.                                                        |
| `sharp` <0.35.0 — libvips CVE-2026-33327/33328/35590/35591                                            | High         | Bundled inside `next@15.x` for image optimisation. Risk applies only if serving attacker-controlled images through `next/image`. This project does not do that at Stage 2.                                                                                                                               | Reassess at Stage 7 if `next/image` is used with user-uploaded images. Otherwise low risk. |
| `esbuild` ≤0.24.2 — dev server request interception                                                   | Moderate     | **Dev-only.** Only affects `npm run dev` via Vitest's vite internals. Not present in production builds.                                                                                                                                                                                                  | Fix at Stage 6: `npm install --save-dev vitest@^4.0.0 @vitest/coverage-v8@^4.0.0`          |

**Next review point:** Stage 7 (Security Review).

---

## 14. Nav Links in `lib/config.ts` (Not Hardcoded in Components)

**Decision:** Export `MARKETING_NAV` and `DASHBOARD_NAV` from `lib/config.ts` as typed arrays; components consume them via `.map()`

**Context:** During Stage 3 build, `marketing-nav.tsx` and `dashboard-nav.tsx` both imported nav link arrays from `lib/config.ts`. The config file was rewritten during Stage 3 and both exports were accidentally dropped, causing runtime crashes (`Cannot read properties of undefined (reading 'map')`).

**Alternatives Considered:**

| Alternative                          | Pros                             | Cons                            | Verdict                                                  |
| ------------------------------------ | -------------------------------- | ------------------------------- | -------------------------------------------------------- |
| Hardcode links in each nav component | Simple                           | Duplicated, drift-prone         | Rejected                                                 |
| Separate `lib/nav.ts` file           | Clean separation                 | Extra file for small data       | Rejected — `lib/config.ts` is already the central config |
| `lib/config.ts` exports              | Single source of truth, testable | Must not be dropped in rewrites | Accepted                                                 |

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

| Alternative                                      | Pros                                                  | Cons                                                   | Verdict  |
| ------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------ | -------- |
| `dotenv` in vitest config                        | Loads real `.env.local`                               | Real secrets in test env; `.env.local` not committed   | Rejected |
| Mock `lib/env.ts` module per test                | Isolated                                              | Boilerplate in every test file                         | Rejected |
| Lazy-evaluate `env` (move parse inside function) | No startup crash                                      | Changes production behaviour; env errors surface later | Rejected |
| `tests/setup.ts` with `process.env` stubs        | One file, zero test-file boilerplate, no real secrets | Stubs must be kept in sync with `lib/env.ts` schema    | Accepted |

**Consequences:**

- `tests/setup.ts` sets all 4 required env vars to safe non-functional placeholder values
- `vitest.config.ts` sets `setupFiles: ['./tests/setup.ts']` — runs before every test file
- `tests/setup.ts` must be updated whenever `lib/env.ts` adds a new required variable
- Never put real API keys or secrets in `tests/setup.ts`

---

## 16. Stripe `current_period_start/end` Breaking Change (SDK v18 / API basil)

**Decision:** Do not upgrade to `stripe@18` or API version `2025-03-31.basil` or later until the DB schema and webhook handler are updated to read period dates from `items.data[0]`.

**Context (verified 2026-08-19 via Perplexity):**
Stripe API version `2025-03-31.basil` (shipped with SDK v18) removed `current_period_start` and `current_period_end` from the **top-level subscription object**. They now live on each subscription item: `subscription.items.data[0].current_period_start` and `subscription.items.data[0].current_period_end`.

This project's `subscriptions` table stores `current_period_start` and `current_period_end` as top-level columns, and the webhook handler in `lib/vendor/stripe/webhook.ts` reads these directly from `subscription.current_period_start` / `subscription.current_period_end`. Upgrading to `stripe@18` without updating the handler would silently write `undefined` / `null` into these columns for every subscription renewal.

**What breaks on stripe@18+ / API 2025-03-31.basil:**

| Location                        | Old path (v17, safe)                     | New path (v18+, basil)                                 |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| `customer.subscription.updated` | `event.data.object.current_period_start` | `event.data.object.items.data[0].current_period_start` |
| `customer.subscription.deleted` | `event.data.object.current_period_end`   | `event.data.object.items.data[0].current_period_end`   |
| `invoice.paid` (expanded sub)   | `subscription.current_period_start`      | `subscription.items.data[0].current_period_start`      |

**Upgrade path (when ready):**

1. Update `lib/vendor/stripe/webhook.ts` to read period dates from `items.data[0]`
2. Update `lib/database.types.ts` if the column semantics change
3. Update `tests/fixtures/webhook-events.ts` — fixtures must reflect new shape
4. Bump `"stripe"` in `package.json` to `"18.x"`
5. Update `STRIPE_API_VERSION` in `.env` and `.env.example` to `2025-03-31.acacia` or later
6. Run `npm test` — all webhook tests must pass before deploying

**Consequences:**

- `stripe@17` is pinned until this migration is performed
- A TypeScript compile error will surface naturally when upgrading (the `current_period_start` property disappears from the SDK types) — treat this as the reminder to complete the upgrade path above
- Do **not** suppress the TS error with a cast (`as any`) — fix the handler properly

---

## 17. AI Toolchain: Perplexity Pro + Claude Sonnet 5 + GitHub MCP

**Decision:** Use Perplexity Pro with Claude Sonnet 5 model selection as the AI orchestration layer; GitHub MCP connector for all repository writes; Supabase MCP connector for database introspection.

**Context (recorded 2026-08-19):**
This project uses a two-role AI workflow: a _research/orchestration_ role (Perplexity Pro) and an _implementation_ role (GitHub MCP). The model selected within Perplexity Pro matters because it determines how reliably multi-step pre-read instructions are followed before writing code.

> **Practical guide:** see [`docs/toolchain.md`](./toolchain.md) for session startup checklist and day-to-day usage.

**Alternatives Considered:**

| Alternative                     | Pros                                                       | Cons                                                                 | Verdict                           |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| GPT-5 / GPT-4.1 via Perplexity  | Strong instruction-following on simple tasks               | 128K context window; weaker at multi-step agentic constraint-holding | Rejected for this workflow        |
| Gemini 2.5 Flash via Perplexity | Fast, large context                                        | Less reliable for constraint-heavy multi-step workflows              | Rejected                          |
| Claude Sonnet 4.5               | Previously the default                                     | Some reported instruction-laziness; superseded by 4.6 and 5          | Superseded                        |
| Claude Sonnet 4.6               | 79.6% SWE-bench, 200K context, reliable                    | Available now; Sonnet 5 preferred when available                     | Fallback if Sonnet 5 unavailable  |
| **Claude Sonnet 5**             | 1M context, best instruction-following, top agentic coding | —                                                                    | **Accepted**                      |
| Claude Code (local agent)       | Full repo access, iterative                                | Requires local setup; higher cost per session                        | Deferred — reconsider at Stage 5+ |

**Why Claude over GPT/Gemini for this workflow:**

- This workflow requires the model to read `CLAUDE.md` → `docs/decisions.md` → act, without dropping constraints across a multi-file session. Claude Sonnet 4.6+ is specifically trained for this kind of sequential instruction-following in agentic contexts.
- The living-doc set (`CLAUDE.md` + `implementation-plan.md` + `decisions.md` + `prompt-plan.md`) exceeds 50K tokens combined. Sonnet 5's 1M context window handles the full set without truncation.
- `CLAUDE.md` has no special meaning to the model — it is just a markdown file read via an explicit GitHub MCP `get_file_contents` call, as directed by `docs/prompt-plan.md` Per-Stage Workflow step 2.

**Consequences:**

- In Perplexity Pro, always select **Claude Sonnet 5** (fallback: Sonnet 4.6)
- GitHub MCP connector handles all repo writes — Perplexity Pro does not commit code directly
- Supabase MCP connector used for schema verification and RLS introspection between stages
- If Sonnet 5 is unavailable, Sonnet 4.6 is an acceptable substitute with no workflow changes required
- Reassess model selection at Stage 5 if Claude Code becomes cost-effective for the session volume

---

## 18. Layered Documentation Strategy

**Decision:** Split documentation into distinct layers with strict single ownership: `AGENTS.md` (orientation) → `CLAUDE.md` (rules) → `docs/architecture.md` (flows) → `docs/schema.md` (data) → `docs/decisions.md` (rationale). Each file owns a unique concern; cross-references use links, never copies.

**Context (recorded 2026-08-19):**
As the repo grew, key content (entitlement event list, stale-processing SQL, RLS service-role explanation, module contract pattern) was duplicated across 3–4 files. Duplicated docs drift out of sync — wrong docs hurt agent output more than missing docs. A DRY audit identified 6 high-priority and 4 medium-priority duplication issues.

**Alternatives Considered:**

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| Single mega-doc (`CLAUDE.md` only) | One place to look | Becomes a wall of text; agents ingest it fully every task | Rejected |
| `AGENTS.md` duplicates `CLAUDE.md` key rules | Redundant safety net | Drifts; two sources of truth for same rule | Rejected |
| Separate doc per topic with no cross-references | Fully independent | Agents lose context when switching files | Rejected |
| **Layered files, single ownership, links not copies** | No drift; fast orientation + deep reference | Requires discipline to maintain | **Accepted** |

**Layer ownership:**

| File | Owns | Does NOT own |
|---|---|---|
| `AGENTS.md` | Stack, commands, directory map, where-to-find-things, constraint *summary* | Rules, rationale, schema detail |
| `CLAUDE.md` | All implementation rules, security constraints, naming, test strategy | Version numbers, decision rationale, schema SQL |
| `docs/architecture.md` | System layer diagram, request flow sequences | Status tables, SQL, decision rationale |
| `docs/schema.md` | Full SQL, RLS policies, entitlement status table, webhook processing SQL | Implementation rules, decision rationale |
| `docs/decisions.md` | Rationale, alternatives considered, consequences | Rules, SQL, flow diagrams |
| `docs/guides/*` | How-to steps for specific tasks | Architectural rules |

**Consequences:**

- When content moves, update one file and add a link from others — never paste the content again
- `docs/guides/ai-agent-tips.md` documents the practical application of this principle for agents
- `AGENTS.md` key constraints section is a *summary with links*, not a copy of `CLAUDE.md` rules
- DRY audit should be run after any major structural change (prompt: "audit documentation for DRYness")
- Factual bugs found during audits (e.g. webhook insert status `'processing'` → `'pending'`) should be fixed immediately — incorrect docs are worse than missing docs

---

## Risks & Mitigations

| Risk                          | Likelihood | Impact | Mitigation                                                             |
| ----------------------------- | ---------- | ------ | ---------------------------------------------------------------------- |
| Webhook race conditions       | Medium     | High   | Atomic claim pattern, transaction boundary                             |
| Stale processing rows         | Low        | Medium | updated_at timeout recovery query                                      |
| RLS misconfiguration          | Low        | High   | Test policies, deny-by-default, no ambiguous policies                  |
| Stripe API version drift      | Medium     | Medium | Pin SDK + API version (Decision #12), upgrade checklist (Decision #16) |
| Stripe basil upgrade          | Low        | High   | Decision #16 upgrade path; TS types will surface error naturally       |
| Vendor lock-in (Supabase)     | High       | Medium | Standard SQL, exportable data                                          |
| Vercel cold starts            | Medium     | Low    | Pro tier, optimize bundle size                                         |
| Nav config dropped in rewrite | Low        | High   | Covered by `tests/config.test.ts` + `tests/nav.test.ts`                |
| AI model regression           | Low        | Medium | Decision #17 fallback: Sonnet 4.6; reassess at Stage 5                 |
| Doc drift / duplication       | Medium     | Medium | ADR-18 single-ownership principle; periodic DRY audit                  |

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
