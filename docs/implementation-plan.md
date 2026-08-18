# Implementation Plan

## Build Order & Acceptance Gates

### Phase 1: Foundation (Day 1-2)

#### 1.1 Project Initialization

- [ ] Initialize Next.js 14+ with App Router, TypeScript strict mode
- [ ] Configure Tailwind CSS with custom theme
- [ ] Set up shadcn/ui-style component system
- [ ] Configure ESLint, Prettier, and path aliases (`@/`)
- [ ] Create base layout with public nav and footer

**Acceptance Gate**: `npm run dev` starts without errors; `/` renders marketing page

---

#### 1.2 Supabase Integration

- [ ] Install `@supabase/supabase-js` and `@supabase/ssr`
- [ ] Configure Supabase client (browser + server)
- [ ] Set up environment validation script
- [ ] Create database migration for `profiles` table
- [ ] Implement Row Level Security policies

**Acceptance Gate**: Authenticated user can read/write their own profile; RLS blocks cross-user access

---

#### 1.3 Authentication Flow

- [ ] Implement Supabase Auth (email/password + OAuth providers)
- [ ] Create `/login`, `/signup`, `/auth/callback` routes
- [ ] Build password recovery flow (`/forgot-password`, `/reset-password`)
- [ ] Add session middleware for protected routes
- [ ] Create `/dashboard` (protected) and `/profile` pages

**Acceptance Gate**: User can sign up, verify email, log in, recover password, access protected dashboard

---

### Phase 2: Billing & Subscriptions (Day 3-4)

#### 2.1 Stripe Integration

- [ ] Install `stripe` SDK (server-side only)
- [ ] Configure Stripe environment variables with version pinning
- [ ] Create `/api/stripe/checkout` endpoint
- [ ] Build pricing page with plan selection
- [ ] Implement Checkout Session creation with metadata (`user_id`, `plan_id`)

**Acceptance Gate**: User can select plan, complete Checkout, return to `/dashboard?session_id=...`

---

#### 2.2 Webhook Infrastructure

- [ ] Create `/api/stripe/webhook` endpoint
- [ ] Implement atomic webhook claim pattern (Redis-free, DB-based)
- [ ] Handle `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`
- [ ] Add retry logic and dead-letter tracking for failed events
- [ ] Log unknown event types without crashing

**Acceptance Gate**: Webhook processes valid events; invalid signatures return 400; retries succeed after simulated failure

---

#### 2.3 Subscription Entitlements

- [ ] Create `subscriptions` table with status tracking
- [ ] Implement entitlement resolution logic (active/past_due/canceled/trialing)
- [ ] Add `has_active_subscription()` helper with unknown-status fallback
- [ ] Build `/billing` page linking to Customer Portal
- [ ] Sync subscription metadata (plan, current_period_end, cancel_at_period_end)

**Acceptance Gate**: User with active subscription sees premium features; canceled users lose access; Portal updates reflect in DB

---

### Phase 3: Polish & Deployment (Day 5-7)

#### 3.1 Environment & Configuration

- [ ] Create `.env.example` with all required variables
- [ ] Add runtime validation script (fail-fast on missing vars)
- [ ] Document Stripe API version pinning strategy
- [ ] Centralize product configuration (`lib/config.ts`)

**Acceptance Gate**: App refuses to start with invalid environment; config is single source of truth

---

#### 3.2 Testing

- [ ] Write unit tests for entitlement logic (Vitest)
- [ ] Add integration tests for webhook handlers
- [ ] Test RLS policies with Supabase test helpers
- [ ] Create test fixtures for subscription states

**Acceptance Gate**: All tests pass; coverage > 70% for critical paths (auth, billing, entitlements)

---

#### 3.3 Documentation & Deployment

- [ ] Write comprehensive `README.md` (setup, migration, deploy)
- [ ] Create `CLAUDE.md` (implementation rules, constraints)
- [ ] Document architectural decisions in `docs/decisions.md`
- [ ] Deploy to Vercel with environment variables
- [ ] Configure production Stripe webhook endpoint

**Acceptance Gate**: Fresh clone + `npm install` + `npm run dev` works; Vercel deploy succeeds; production webhook receives events

---

## Risk Mitigation

| Risk                     | Mitigation                                                                |
| ------------------------ | ------------------------------------------------------------------------- |
| Webhook race conditions  | Atomic claim pattern with DB row locking                                  |
| Subscription state drift | Treat webhooks as source of truth; periodic reconciliation job (optional) |
| RLS misconfiguration     | Test policies with multiple users; deny-by-default                        |
| Stripe API version drift | Pin version in env; document upgrade path                                 |
| Vendor lock-in           | Isolate Supabase/Stripe code in `lib/vendor/`                             |

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

Modules are designed as opt-in additions:

```
lib/modules/
├── workspaces/      # Multi-tenant teams (requires schema changes)
├── usage-billing/   # Metered events + invoices
├── storage/         # Supabase Storage wrappers
├── email/           # Resend integration
├── analytics/       # PostHog client
└── ai/              # LLM API clients
```

Each module:

- Has its own database migrations
- Exports a single `init()` function
- Does not modify core tables
- Can be removed without breaking core

---

## Next Steps

1. **Approve this plan** (or request changes)
2. **Answer decision questions** (see end of `CLAUDE.md`)
3. **Begin Phase 1** with `npx create-next-app`
