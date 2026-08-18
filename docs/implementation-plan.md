# Implementation Plan

## Build Order & Acceptance Gates

### Phase 1: Foundation (Day 1-2)

#### 1.1 Project Initialization

- [ ] Initialize Next.js 14+ with App Router, TypeScript strict mode
- [ ] Configure Tailwind CSS with custom theme
- [ ] Set up shadcn/ui-style component system
- [ ] Configure ESLint, Prettier, and path aliases (`@/`)
- [ ] Create base layout with public nav and footer
- [ ] **Use `npm` exclusively** — no pnpm or yarn

**Acceptance Gate:** `npm run dev` starts without errors; `/` renders marketing page

---

#### 1.2 Supabase Integration

- [ ] Install `@supabase/supabase-js` and `@supabase/ssr`
- [ ] Configure Supabase client (browser + server), always under `lib/` (not `src/lib/`)
- [ ] Set up environment validation (`lib/env.ts` with Zod)
- [ ] **Generate `supabase/migrations/0001_initial.sql`** from `docs/schema.md` — this file must exist before any application code references database tables
- [ ] Implement RLS policies as specified in `docs/schema.md`

**Acceptance Gate:** `npx supabase db reset` applies cleanly; authenticated user can read/write own profile; RLS blocks cross-user access

---

#### 1.3 Authentication Flow

- [ ] Implement Supabase Auth (email/password + OAuth providers)
- [ ] Create `/login`, `/signup`, `/auth/callback` routes
- [ ] Build password recovery flow (`/forgot-password`, `/reset-password`)
- [ ] Add session middleware for protected routes
- [ ] Create `/dashboard` (protected) and `/profile` pages

**Acceptance Gate:** User can sign up, verify email, log in, recover password, access protected dashboard

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
- [ ] **Wrap subscription upsert + status update in a single database transaction** — a crash must not leave a permanently misleading `processing` row
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

**Acceptance Gate:** Active users see premium features; `past_due` users are denied by default; Portal updates reflect in DB; changing `pastDueGracePeriod` changes behaviour without touching `entitlements.ts`

---

### Phase 3: Polish & Deployment (Day 5-7)

#### 3.1 Environment & Configuration

- [ ] Create `.env.example` with all required variables (including `STRIPE_API_VERSION`)
- [ ] Document that `stripe` SDK version in `package.json` and `STRIPE_API_VERSION` must be upgraded together
- [ ] Centralize all product settings in `lib/config.ts`

**Acceptance Gate:** App refuses to start with invalid/missing environment variables; config is single source of truth

---

#### 3.2 Testing

- [ ] Write unit tests for entitlement logic (including `past_due` default behaviour)
- [ ] Add integration tests for webhook handlers (including transaction rollback scenario)
- [ ] Test RLS policies with Supabase test helpers
- [ ] Create test fixtures for subscription states

**Acceptance Gate:** All tests pass; coverage matches targets in `CLAUDE.md` §8 (100% auth, 100% entitlements, 90% webhooks, 80% RLS). The flat 70% figure is a minimum floor, not the target.

---

#### 3.3 Documentation & Deployment

- [ ] Confirm all `README.md` commands match actual `package.json` scripts
- [ ] Update `CLAUDE.md` if new conventions were introduced
- [ ] Deploy to Vercel (`npm run build` must pass cleanly)
- [ ] Configure production Stripe webhook endpoint
- [ ] Run `npx supabase db push` against production project

**Acceptance Gate:** Fresh clone + `npm install` + `npm run dev` works; Vercel deploy succeeds; production webhook receives events

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
├── workspaces/ # Multi-tenant teams — REQUIRES schema additions (new tables + FK to profiles)
├── usage-billing/ # Metered events — REQUIRES schema additions (may need billing-owner on subscriptions)
├── storage/ # Supabase Storage wrappers
├── email/ # Resend integration
├── analytics/ # PostHog client
└── ai/ # LLM API clients
```

Each module exports a single `init()` function and has its own migrations. `workspaces` and `usage-billing` are exceptions to the "no core-table impact" rule — review `docs/decisions.md` before activating them.

---

## Next Steps

1. **Approve this plan** (or request changes)
2. **Answer decision questions** (see `CLAUDE.md`)
3. **Begin Phase 1** with `npx create-next-app@latest`
