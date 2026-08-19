# Implementation Plan

> **Living document** — update this file whenever a task is completed or a decision changes. Keep checkboxes, status notes, and acceptance gates current.
>
> **Risks, non-goals, and architectural rationale** are documented in [`docs/decisions.md`](./decisions.md) — do not duplicate them here.

## Build Order & Acceptance Gates

### Phase 1: Foundation — COMPLETE ✅

#### 1.1 Project Initialization

- [x] Initialize Next.js 15 with App Router, TypeScript strict mode
- [x] Configure Tailwind CSS with custom theme
- [x] Set up shadcn/ui-style component system
- [x] Configure ESLint, Prettier, and path aliases (`@/`)
- [x] Create base layout with public nav and footer
- [x] **Use `npm` exclusively** — no pnpm or yarn
- [x] Pin Node.js 22 LTS in `.nvmrc` and `engines` in `package.json`

**Acceptance Gate:** `npm run dev` starts without errors; `/` renders marketing page ✅

---

#### 1.2 Supabase Integration

- [x] Install `@supabase/supabase-js` and `@supabase/ssr`
- [x] Configure Supabase client (browser + server), always under `lib/` (not `src/lib/`)
- [x] Set up environment validation (`lib/env.ts` with Zod)
- [x] **Generate `supabase/migrations/0001_initial.sql`** from `docs/schema.md`
- [x] Implement RLS policies as specified in `docs/schema.md`
- [x] Harden migration: `SET search_path = ''` on all functions; revoke `EXECUTE` on trigger functions from `anon`/`authenticated`
- [x] Apply migration to Supabase project
- [x] Generate `lib/database.types.ts` from live schema; add `SubscriptionStatus` and `WebhookEventStatus` aliases

**Acceptance Gate:** Migration applied cleanly; authenticated user can read/write own profile; RLS blocks cross-user access ✅

---

#### 1.3 Authentication Flow

- [x] Implement Supabase Auth (email/password)
- [x] Create `/login`, `/signup`, `/auth/callback`, `/forgot-password`, `/reset-password` routes
- [x] Add session middleware for protected routes
- [x] Create `/dashboard` (protected) page
- [x] Wire real `SignOutButton` into `DashboardNav`
- [x] Export `MARKETING_NAV` and `DASHBOARD_NAV` from `lib/config.ts` (single source of truth)

**Acceptance Gate:** User can sign up, log in, access protected dashboard, sign out ✅

---

#### 1.4 Testing & CI

- [x] Add `tests/setup.ts` — stubs env vars so `lib/env.ts` doesn't crash at Vitest import time
- [x] Write unit tests: `config`, `entitlements`, `env`, `nav`, `rls` — 5 suites, 20 tests, all passing
- [x] Configure `vitest.config.ts` `setupFiles` to point to `tests/setup.ts`
- [x] Add GitHub Actions CI (`.github/workflows/ci.yml`) — 3 parallel jobs: validate, build, test+coverage
- [x] Add `tests/fixtures/subscriptions.ts` — typed fixtures for all 7 DB subscription statuses
- [x] Add `tests/fixtures/webhook-events.ts` — Stripe event payloads for all 5 entitlement-controlling events + ignored events
- [x] Add `tests/webhook.test.ts` — skeleton: idempotency, event routing, stale-processing recovery contracts
- [x] Add `tests/billing.test.ts` — skeleton: checkout contract, fixture coverage, `BILLING_CONFIG` policy

**Current test status:** 5 active suites · 20 tests · all passing ✅ | 2 skeletons ready for Phase 2
**CI status:** Lint ✅ · Typecheck ✅ · Build ✅ · Tests ✅

**Acceptance Gate:** All tests pass; CI green on push/PR to main ✅

---

#### 1.5 Manual Verification — COMPLETE ✅

- [x] `webhook_events` inaccessible to authenticated users — **verified 2026-08-19**
  - RLS enabled (`relrowsecurity: true` on `pg_class`)
  - Zero authenticated-user policies (`pg_policies` returns 0 rows)
  - Deny-by-default confirmed
- [ ] Service-role write to `webhook_events` works server-side — **deferred to Phase 2.2 gate** (requires webhook handler)

---

### Phase 2: Billing & Subscriptions — IN PROGRESS 🔜

#### 2.1 Stripe Integration

- [ ] Install `stripe` SDK — **pin `"stripe": "17.x"`** in `package.json`. See [`docs/decisions.md` Decision #12](./decisions.md) for version rationale and Decision #16 for the upgrade path.
- [ ] Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_API_VERSION` to `.env.example`
- [ ] Add Stripe vars to `lib/env.ts` Zod schema
- [ ] Add Stripe var stubs to `tests/setup.ts` and `.github/workflows/ci.yml env:`
- [ ] Create `lib/vendor/stripe/client.ts` — initialise with validated `env` object, not raw `process.env`
- [ ] Create `/api/stripe/checkout` endpoint with `user_id` in session metadata
- [ ] Build pricing page (`/pricing`) with plan selection
- [ ] Create `/api/stripe/portal` endpoint
- [ ] Build billing page (`/billing`) with current subscription display + portal link

**Acceptance Gate:** User can select plan, complete Checkout, return to `/dashboard?session_id=...`; portal opens

---

#### 2.2 Webhook Infrastructure

- [ ] Create `/api/stripe/webhook` endpoint with signature verification
- [ ] Implement atomic webhook claim: `UPDATE webhook_events SET status = 'processing' WHERE stripe_event_id = $1 AND status = 'pending' RETURNING id`
- [ ] **Wrap subscription upsert + status update in a single database transaction**
- [ ] Confirm `updated_at` exists on `webhook_events` (already in `0001_initial.sql` — verify)
- [ ] Document stale-processing recovery query in README
- [ ] Handle all 5 entitlement-controlling events (see `tests/fixtures/webhook-events.ts`)
- [ ] Log unknown event types without crashing (return 200)
- [ ] Activate commented assertions in `tests/webhook.test.ts` as handler is built
- [ ] **Verify service-role client can write to `webhook_events`** ← Phase 1 deferred gate

**Acceptance Gate:** Valid events processed atomically; invalid signatures return 400; stale `processing` rows reset via documented query; retries succeed after simulated failure

---

#### 2.3 Subscription Entitlements

- [x] `BILLING_CONFIG.pastDueGracePeriod: false` defined in `lib/config.ts`
- [x] `lib/entitlements.ts` — `hasActiveSubscription()` reads from `BILLING_CONFIG`
- [ ] Add `getCurrentSubscription()` server helper
- [ ] Gate dashboard/premium features using `requireActiveSubscription()`
- [ ] Sync `cancel_at_period_end` and `current_period_end` from webhook events
- [ ] Activate commented assertions in `tests/billing.test.ts` as billing code is built

**Acceptance Gate:** Active users see premium features; `past_due` denied by default; portal updates reflect in DB

---

### Phase 3: Polish & Deployment

#### 3.1 Environment & Configuration

- [x] `.env.example` with Phase 1 variables
- [ ] Update `.env.example` with Phase 2 Stripe variables
- [x] Centralize all product settings in `lib/config.ts`

**Acceptance Gate:** App refuses to start with invalid/missing env vars ✅

---

#### 3.2 Documentation & Deployment

- [x] `CHANGELOG.md` — updated on every release
- [x] `tests/README.md` — kept current
- [x] `docs/implementation-plan.md` — this file, living document
- [x] `docs/prompt-plan.md` — kept current
- [x] `README.md` — kept current
- [x] `CLAUDE.md` — kept current
- [ ] Confirm all `README.md` commands match actual `package.json` scripts (Phase 3 gate)
- [ ] Deploy to Vercel
- [ ] Configure production Stripe webhook endpoint
- [ ] Run `npx supabase db push` against production project

**Acceptance Gate:** Fresh clone + `npm install` + `npm run dev` works; Vercel deploy succeeds

---

## Living Document Policy

Every commit that completes a task, changes a convention, or introduces a new file must:

1. Check the relevant task off in this file
2. Update `CHANGELOG.md` with a versioned entry
3. Update `README.md` if setup steps, routes, or env vars changed
4. Update `CLAUDE.md` if a convention changed
5. Update `docs/prompt-plan.md` if a stage prompt or checklist changed
6. Update `tests/README.md` if test files were added or changed
7. Update `docs/decisions.md` if a version number, risk, ADR rationale, or architectural choice changed
8. Update the **`CLAUDE.md` Section 1 directory tree** if any file or folder was added, moved, or deleted

---

## Stage Close Checklist

Run this checklist at the end of every stage before committing. Do not skip it.

- [ ] All stage tasks checked off above
- [ ] `docs/decisions.md` — any new ADRs added? Any version numbers or risks changed?
- [ ] `CHANGELOG.md` — `[Unreleased]` section updated with all functional and structural changes from this stage
- [ ] `CLAUDE.md` — directory tree (Section 1) reflects all new/moved/deleted files; `<!-- sync: decisions.md -->` markers checked; conventions current
- [ ] `docs/prompt-plan.md` — stage checklist ticked; prompt updated if approach changed
- [ ] `README.md` — routes, env vars, setup steps still accurate?
- [ ] `tests/README.md` — test files or fixtures added or changed?
- [ ] `npm run validate` passes (lint + typecheck + tests)
- [ ] `npm run build` passes

---

## Optional Module Boundaries

```text
lib/modules/
├── workspaces/     # Multi-tenant teams — REQUIRES schema additions
├── usage-billing/  # Metered events — REQUIRES schema additions
├── storage/        # Supabase Storage wrappers
├── email/          # Resend integration
├── analytics/      # PostHog client
└── ai/             # LLM API clients
```

Each module exports a single `init()` function and has its own migrations. Full module boundary rules in [`docs/decisions.md` Decision #10](./decisions.md).
