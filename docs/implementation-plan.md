# Implementation Plan

## Phase 1 — Foundation (Stage 1) ✅

### 1.1 Project Setup
- [x] Next.js 15 app with TypeScript, Tailwind, Supabase
- [x] ESLint, Prettier, Vitest configured
- [x] CI pipeline with test, lint, typecheck

### 1.2 Authentication
- [x] Supabase Auth integration
- [x] Auth guard for dashboard routes
- [x] Profile sync on signup

### 1.3 Marketing Site
- [x] Landing page
- [x] Pricing page (static)
- [x] Dashboard layout

**Gate 1 Passed**: ✅ Auth flow works, marketing pages render, CI green

---

## Phase 2 — Stripe Billing (Stage 2, 3, 4) ✅

### 2.1 Stripe Infrastructure (Stage 4.1–4.3) ✅

- [x] Env vars, SDK pin, env validation (#4)
- [x] `lib/vendor/stripe/` scaffold (#5)
- [x] Webhook handler with atomic claim (#6)

**Gate 2.1 Passed**: ✅ Env validation passes, Stripe client initializes, webhook route exists

### 2.2 Entitlements + UI (Stage 4.4–4.5) ✅

- [x] Entitlement logic: `hasActiveSubscription()`, `requireActiveSubscription()` (#7)
- [x] Checkout, Portal, Pricing, Billing pages (#8)
- [x] Service-role write to `webhook_events` confirmed

**Gate 2.2 Passed**: ✅ Entitlements gate premium access, billing pages show live data, Phase 2.2 gate confirmed

### 2.3 Tests + Close (Stage 4.6–4.7) ✅

- [x] Webhook and billing tests activated (#9)
- [x] Living docs updated (#10)
- [x] Manual verification checklist complete
- [x] `npm run validate` passes
- [x] `npm run build` passes

**Gate 2.3 Passed**: ✅ All tests green, docs updated, Stage 4 complete

---

## Phase 3 — Future Enhancements (TBD)

### 3.1 Usage Billing
- [ ] Metered billing with Stripe
- [ ] Usage tracking and limits
- [ ] Overage charges

### 3.2 Team Plans
- [ ] Multi-seat subscriptions
- [ ] Team member management
- [ ] Role-based access control

### 3.3 Annual Plans
- [ ] Annual pricing with discount
- [ ] Plan switching logic
- [ ] Proration handling

---

## Notes

- All Stripe SDK calls use pinned version from `lib/vendor/stripe/client.ts`
- Webhook events processed idempotently with atomic claim pattern
- Service-role client used only server-side for entitlement checks
- `past_due` grace period off by default (configurable in `lib/config.ts`)
