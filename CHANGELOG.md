# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

_Nothing yet — Phase 2 (Stripe) work begins next._

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
- `docs/decisions.md` — 15 ADRs covering architecture, tooling, and conventions
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
