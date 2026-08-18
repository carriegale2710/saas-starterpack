# Implementation Plan

## Build Order & Acceptance Gates

### Phase 1: Foundation (Day 1-2)

#### 1.1 Project Initialization

- [x] Initialize Next.js 14+ with App Router, TypeScript strict mode
- [x] Configure Tailwind CSS with custom theme
- [x] Set up shadcn/ui-style component system
- [x] Configure ESLint, Prettier, and path aliases (`@/`)
- [x] Create base layout with public nav and footer
- [x] **Use `npm` exclusively** — no pnpm or yarn

**Acceptance Gate:** `npm run dev` starts without errors; `/` renders marketing page ✅

---

#### 1.2 Supabase Integration

- [x] Install `@supabase/supabase-js` and `@supabase/ssr`
- [x] Configure Supabase client (browser + server), always under `lib/` (not `src/lib/`)
- [x] Set up environment validation (`lib/env.ts` with Zod)
- [x] **Generate `supabase/migrations/0001_initial.sql`** from `docs/schema.md`
- [x] Implement RLS policies as specified in `docs/schema.md`
- [x] Harden migration: `SET search_path = ''` on all functions; revoke `EXECUTE` on trigger functions from `anon`/`authenticated`
- [x] Apply migration manually to Supabase project (Docker skipped — applied via Supabase dashboard)

**Acceptance Gate:** Migration applied cleanly; authenticated user can read/write own profile; RLS blocks cross-user access ✅

---

#### 1.3 Authentication Flow

- [x] Implement Supabase Auth (email/password)
- [x] Create `/login`, `/signup`, `/auth/callback` routes
- [x] Add session middleware for protected routes
- [x] Create `/dashboard` (protected) page
- [x] Wire real `SignOutButton` into `DashboardNav` (replaced Stage 2 disabled placeholder)
- [x] Export `MARKETING_NAV` and `DASHBOARD_NAV` from `lib/config.ts` (single source of truth for nav links)

**Acceptance Gate:** User can sign up, log in, access protected dashboard, sign out ✅

---

### Phase 2: Billing & Subscriptions (Day 3-4)

#### 2.1 Stripe Integration

- [ ] Install `stripe` SDK — **pin to an exact version** in `package.json` (e.g. `"stripe": "16.3.0"`, not `"16.x"`). Exact pinning prevents silent patch/minor changes. See `docs/decisions.md` #12.
- [ ] Set `STRIPE_API_VERSION` in `.env.example` and validate in `lib/env.ts`
- [ ] Create `/api/stripe/checkout` endpoint
- [ ] Build pricing page with plan selection
- [ ] Implement Checkout Session creation with metadata (`user_id`, `plan_id`)

**Acceptance Gate:** User can select plan, complete Checkout, return to `/dashboard?session_id=...`

---

#### 2.2 Webhook Infrastructure

- [ ] Create `/api/stripe/webhook` endpoint
- [ ] Implement atomic webhook claim: `UPDATE webhook_events SET status = 'processing' WHERE stripe_event_id = $1 AND status = 'pending' RETURNING id`
- [ ] **Wrap subscription upsert + status update in a single database transaction**
- [ ] Add `updated_at` to `webhook_events` and document stale-processing recovery query
- [ ] Handle `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`
- [ ] Log unknown event types without crashing

**Acceptance Gate:** Valid events processed atomically; invalid signatures return 400; stale `processing` rows can be reset via the documented query; retries succeed after simulated failure

---

#### 2.3 Subscription Entitlements

- [ ] Define `BILLING_CONFIG.pastDueGracePeriod` in `lib/config.ts` — default `false` (no access on `past_due`)
- [ ] Implement `lib/entitlements.ts` reading from `BILLING_CONFIG`
- [ ] Add `hasActiveSubscription()` helper with unknown-status deny-by-default fallback
- [ ] Build `/billing` page linking to Customer Portal
- [ ] Sync subscription metadata (`plan`, `current_period_end`, `cancel_at_period_end`)

**Acceptance Gate:** Active users see premium features; `past_due` users are denied by default; Portal updates reflect in DB

---

### Phase 3: Polish & Deployment (Day 5-7)

#### 3.1 Environment & Configuration

- [x] Create `.env.example` with all required variables
- [x] Centralize all product settings in `lib/config.ts`
- [x] `MARKETING_NAV` and `DASHBOARD_NAV` exported from `lib/config.ts`

**Acceptance Gate:** App refuses to start with invalid/missing env vars; config is single source of truth ✅

---

#### 3.2 Testing

- [x] Write unit tests for entitlement logic (including `past_due` default behaviour)
- [x] Test RLS policies with documented test cases
- [x] Test `MARKETING_NAV` and `DASHBOARD_NAV` shape, uniqueness, and group isolation
- [x] Add `tests/setup.ts` to stub env vars — prevents `lib/env.ts` Zod crash at import time in Vitest
- [x] Configure `vitest.config.ts` `setupFiles` to point to `tests/setup.ts`
- [x] Add GitHub Actions CI (`/.github/workflows/ci.yml`) — lint, typecheck, test on push/PR to `main`
- [x] Fix `lib/database.types.ts` (was empty — populated from live Supabase schema)
- [x] Add `SubscriptionStatus` and `WebhookEventStatus` type aliases to `lib/database.types.ts`
- [x] Add `description` to `APP_CONFIG` in `lib/config.ts`
- [ ] Add integration tests for webhook handlers (including transaction rollback scenario)
- [ ] Create test fixtures for subscription states

**Current test status:** 5 suites, 20 tests, all passing ✅
**CI status:** Lint ✅ · Typecheck ✅ · Tests ✅

**Acceptance Gate:** All tests pass; coverage matches targets in `CLAUDE.md` §8

---

#### 3.3 Documentation & Deployment

- [x] `CHANGELOG.md` created
- [x] `tests/README.md` created
- [ ] Confirm all `README.md` commands match actual `package.json` scripts
- [ ] Update `CLAUDE.md` if new conventions were introduced
- [ ] Deploy to Vercel (`npm run build` must pass cleanly)
- [ ] Configure production Stripe webhook endpoint
- [ ] Run `npx supabase db push` against production project

**Acceptance Gate:** Fresh clone + `npm install` + `npm run dev` works; Vercel deploy succeeds

---

## Risk Mitigation

| Risk                     | Mitigation                                                                    |
| ------------------------ | ----------------------------------------------------------------------------- |
| Webhook race conditions  | Atomic claim pattern with DB row locking                                      |
| Stale processing rows    | `updated_at` timeout recovery query (documented in README)                    |
| Subscription state drift | Webhooks as source of truth; periodic reconciliation job (optional)           |
| RLS misconfiguration     | Test with multiple users; deny-by-default; no ambiguous service-role policies |
| Stripe API version drift | Pin SDK version + API version string together; test on upgrade                |
| Vendor lock-in           | Isolate Supabase/Stripe code in `lib/vendor/`                                 |

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

## Optional Module Boundaries

```text
lib/modules/
├── workspaces/ # Multi-tenant teams — REQUIRES schema additions
├── usage-billing/ # Metered events — REQUIRES schema additions
├── storage/ # Supabase Storage wrappers
├── email/ # Resend integration
├── analytics/ # PostHog client
└── ai/ # LLM API clients
```

Each module exports a single `init()` function and has its own migrations.
