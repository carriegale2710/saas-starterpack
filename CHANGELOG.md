# Changelog

> All notable changes to this project will be documented here. It does NOT record reasons for changes - those go in `docs/decisions.md`
> Follow this format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Ensure each change fits on a single line, do not overbloat.

---

## [Unreleased]

### Added

- `AGENTS.md` — tool-agnostic agent orientation layer for Cursor, Copilot, Windsurf, and Claude Code
- `docs/architecture.md` — system layer diagram, request flow sequences, and entitlement logic chain
- `docs/guides/adding-a-module.md` — guide for scaffolding and removing optional feature modules
- `docs/guides/ai-agent-tips.md` — documentation and naming tips optimised for AI agent workflows
- ADR-18 in `docs/decisions.md` — layered documentation strategy and single-ownership principle

### Changed

- `CLAUDE.md` — DRY pass: removed duplicated content now owned by `schema.md`, guides, and `decisions.md`; trimmed verbose prose sections
- `docs/README.md` — consolidated reading order and reference index into a single numbered table
- `docs/schema.md` — removed stale sections; trimmed repeated explanations to single canonical locations
- `docs/architecture.md` — fixed webhook status bug (`pending` not `processing`); removed content now owned by `schema.md` and `decisions.md`
- `AGENTS.md` — updated where-to-find-things table with new guide entries
- `docs/prompt-plan.md` — added Stage Close checklist (doc audit, changelog, decisions review, sync check) to Stages 4–8; corrected Stripe version values
- `docs/implementation-plan.md` — added Stage Close Checklist section; added `decisions.md` to Living Document Policy

---

## [0.1.1] — 2026-08-19

Pre-Phase-2 cleanup and test scaffolding. No functional changes.

### Added

- `tests/fixtures/subscriptions.ts` — typed `MockSubscription` fixtures for all 8 subscription statuses
- `tests/fixtures/webhook-events.ts` — Stripe event payloads for all 5 entitlement-controlling events plus ignored event fixtures
- `tests/webhook.test.ts` — skeleton suite: idempotency, event routing, stale-processing recovery
- `tests/billing.test.ts` — skeleton suite: checkout session contract, subscription fixtures, `BILLING_CONFIG` policy assertions

### Changed

- `.github/workflows/ci.yml` — refactored to 3 parallel jobs: `validate` → `build` + `test`; shared `env:` block; `npm run build` added to CI
- `tests/README.md` — updated with fixture docs and CI job diagram
- `README.md` — corrected Node.js (22 LTS) and Next.js (15) versions; split env vars table by phase; fixed `BILLING_CONFIG` reference
- `CLAUDE.md` — synced Node 22, `database.types.ts` regen rule, CI workflow, test file list

---

## [0.1.0] — 2026-08-19

Phase 1 complete. Foundation stable, all tests passing, CI green.

### Added

- Next.js 15 App Router with TypeScript strict mode, Tailwind CSS, and shadcn/ui-style components
- Supabase integration: browser client, server client, SSR middleware
- Database schema: `profiles`, `subscriptions`, `webhook_events` with RLS policies and initial migration
- Environment validation at startup via `lib/env.ts` (Zod)
- Auth flow: `/login`, `/signup`, `/auth/callback`, `/dashboard` (protected)
- `lib/entitlements.ts` — `hasActiveSubscription()` and `requireActiveSubscription()`
- `lib/config.ts` — `APP_CONFIG`, `BILLING_CONFIG`, `MARKETING_NAV`, `DASHBOARD_NAV`
- `lib/database.types.ts` — generated from live Supabase schema; `SubscriptionStatus` and `WebhookEventStatus` type aliases
- GitHub Actions CI workflow — lint, typecheck, and tests on every push/PR to `main`
- Vitest test suite: 5 suites, 20 tests, all passing (`config`, `entitlements`, `env`, `nav`, `rls`)
- `tests/setup.ts`, `tests/README.md`, `.env.example`, `CHANGELOG.md`
- `docs/decisions.md` — ADRs 1–17 covering architecture, tooling, and conventions
- `docs/implementation-plan.md` — phased build plan with acceptance gates
- `docs/schema.md` — full database schema documentation

### Architecture Decisions (ADR-1 – ADR-17)

- Modular monolith, Supabase PostgreSQL with RLS, Stripe webhooks as source of truth
- Atomic webhook claim (no Redis), shadcn/ui-style components, Next.js App Router
- No ORM, Zod env validation, npm, optional module boundaries, mandatory RLS
- Stripe SDK + API version pinning, nav in `lib/config.ts`, Vitest env setup
- Stripe `current_period_start/end` breaking change (SDK v18/basil), AI toolchain (Perplexity Pro + Claude Sonnet 5 + GitHub MCP)
