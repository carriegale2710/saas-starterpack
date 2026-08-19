# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Changed
- `CLAUDE.md` — removed stale `stripe@16.3.0` / `2024-06-20` version values; replaced with pointer to `docs/decisions.md` Decision #12 as single source of truth; removed duplicate risks table (now only in `decisions.md`); added `<!-- sync: decisions.md -->` comments on all sections that reference values owned elsewhere; added "Keeping This File Fresh" section with explicit rules
- `docs/prompt-plan.md` — corrected Stage 4 "Confirmed Versions" block to `stripe@17.x` / `2025-11-20.acacia`; added `docs/decisions.md` to Living Document Policy table (was missing); added single-ownership rule to Documentation Layout section; added step 2 to Per-Stage Workflow (re-read `CLAUDE.md` + `decisions.md` before coding); added `<!-- sync -->` marker to Stage 4 versions block; added `CLAUDE.md` consistency check to Stage 6 audit list
- `docs/prompt-plan.md` — added Stage Close checklist to Stages 4–8: doc staleness audit, `CHANGELOG.md` entry, `decisions.md` review, `CLAUDE.md` sync check, Living Document Policy sweep
- `docs/implementation-plan.md` — added `docs/decisions.md` as step 7 in Living Document Policy (was missing); added Stage Close Checklist section

---

## [0.1.1] — 2026-08-19

Pre-Phase-2 cleanup and test scaffolding. No functional changes.

### Added
- `tests/fixtures/subscriptions.ts` — typed `MockSubscription` fixtures for all 8 subscription statuses; keyed as `Record<SubscriptionStatus, MockSubscription>` so TypeScript catches missing statuses
- `tests/fixtures/webhook-events.ts` — plain-object Stripe event payloads for all 5 entitlement-controlling events + `ignoredEventFixtures` (events the handler must swallow without crashing)
- `tests/webhook.test.ts` — skeleton test suite: idempotency logic, event routing contracts, stale-processing recovery threshold; commented assertions activate as Phase 2 handler is implemented
- `tests/billing.test.ts` — skeleton test suite: checkout session contract (metadata, mode, redirect URL), subscription fixture coverage, `BILLING_CONFIG` policy assertions

### Changed
- `.github/workflows/ci.yml` — restructured from 1 job to 3 parallel jobs:
  - `validate` (lint + typecheck, ~30s) runs first
  - `build` (Next.js build) and `test` (vitest + coverage) run in parallel after validate
  - Shared `env:` block at workflow level — no duplication across jobs
  - `npm run build` now runs in CI, catching Next.js build errors that typecheck alone misses
- `tests/README.md` — updated with fixture documentation, CI job diagram, skeleton test conventions
- `README.md` — Node.js version corrected to 22 LTS; Next.js version corrected to 15; Stripe features correctly marked as Phase 2; env vars table split by phase; `BILLING_PAST_DUE_GRACE` reference corrected to `BILLING_CONFIG.pastDueGracePeriod`
- `CLAUDE.md` — synced with new conventions: Node 22, `database.types.ts` regeneration rule, nav in `lib/config.ts` (ADR-14), `tests/setup.ts` sync rule (ADR-15), CI workflow documented, actual test file list updated

---

## [0.1.0] — 2026-08-19

Phase 1 complete. Foundation is stable, all tests passing, CI green.

### Added
- Next.js 15 App Router project with TypeScript strict mode
- Tailwind CSS + shadcn/ui-style component system
- Supabase integration: browser client, server client, SSR middleware
- Database schema: `profiles`, `subscriptions`, `webhook_events` with RLS policies
- Migration `supabase/migrations/0001_initial.sql` applied to Supabase project
- Environment validation at startup via `lib/env.ts` (Zod)
- Auth flow: `/login`, `/signup`, `/auth/callback`, `/dashboard` (protected)
- `SignOutButton` wired into `DashboardNav`
- `APP_CONFIG`, `BILLING_CONFIG`, `MARKETING_NAV`, `DASHBOARD_NAV` exported from `lib/config.ts`
- `lib/entitlements.ts` — `hasActiveSubscription()` and `requireActiveSubscription()` with `BILLING_CONFIG.pastDueGracePeriod` policy
- `lib/database.types.ts` — generated from live Supabase schema; includes `SubscriptionStatus` and `WebhookEventStatus` type aliases
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) — lint, typecheck, tests on every push/PR to `main`
- Vitest test suite: 5 suites, 20 tests, all passing ✅
  - `tests/config.test.ts` — APP_CONFIG and BILLING_CONFIG shape
  - `tests/entitlements.test.ts` — access logic for all subscription statuses
  - `tests/env.test.ts` — Zod env schema validation
  - `tests/nav.test.ts` — nav array shape, uniqueness, group isolation
  - `tests/rls.test.ts` — RLS policy documentation tests
- `tests/setup.ts` — env var stubs so `lib/env.ts` doesn't crash at Vitest import time
- `tests/README.md` — test suite documentation
- `.env.example` with all required variables
- `CHANGELOG.md`
- `docs/decisions.md` — 16 ADRs covering architecture, tooling, and conventions
- `docs/implementation-plan.md` — phased build plan with acceptance gates
- `docs/schema.md` — full database schema documentation

### Architecture decisions recorded
- ADR-1: Modular monolith (no microservices)
- ADR-2: Supabase managed PostgreSQL with RLS
- ADR-3: Stripe webhooks as source of truth
- ADR-4: Atomic webhook claim pattern (no Redis)
- ADR-5: shadcn/ui-style components
- ADR-6: Next.js App Router
- ADR-7: No ORM (raw Supabase client)
- ADR-8: Zod env validation at runtime
- ADR-9: npm as package manager
- ADR-10: Optional module boundaries
- ADR-11: Security boundaries (RLS mandatory)
- ADR-12: Stripe SDK + API version pinning
- ADR-13: Audit flag review (Stage 2)
- ADR-14: Nav links in `lib/config.ts`
- ADR-15: Vitest env setup file
- ADR-16: Stripe `current_period_start/end` breaking change (SDK v18 / API basil)
