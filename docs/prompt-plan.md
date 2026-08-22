# Prompt Plan — SaaS Starterpack

## Stage 1 — Foundation ✅

- [x] Next.js 15 app scaffold
- [x] Supabase Auth integration
- [x] Marketing pages (landing, pricing)
- [x] Dashboard with auth guard
- [x] Profile sync on signup
- [x] CI/CD pipeline

**Status**: Complete — Stage 1 shipped

---

## Stage 2 — Stripe Billing PRD ✅

- [x] User stories defined
- [x] Files to touch identified
- [x] Test seams specified
- [x] Out of scope documented
- [x] Constraints recorded

**Status**: Complete — PRD in issue #3

---

## Stage 3 — Stripe Implementation ✅

- [x] Env vars and SDK pin
- [x] Stripe client module
- [x] Webhook handler
- [x] Entitlement logic
- [x] Checkout and portal routes
- [x] Billing and pricing pages

**Status**: Complete — Implementation in PR #11

---

## Stage 4 — Stage Close ✅

### 4.1 Infrastructure ✅
- [x] Env vars, SDK pin, validation
- [x] `lib/vendor/stripe/` scaffold
- [x] Webhook handler with atomic claim

### 4.2 Entitlements + UI ✅
- [x] Entitlement logic implemented
- [x] Checkout, Portal, Pricing, Billing pages wired

### 4.3 Tests ✅
- [x] Webhook tests activated (idempotency, event routing, stale recovery)
- [x] Billing tests activated (checkout contract, status mapping, past_due)
- [x] New tests added (invalid signature, rollback, requireActiveSubscription)
- [x] `npm run validate` passes

### 4.4 Living Docs ✅
- [x] `CHANGELOG.md` updated with Phase 2 entries
- [x] `CLAUDE.md` directory tree updated
- [x] `README.md` Stripe docs added
- [x] `docs/implementation-plan.md` Phase 2 tasks ticked
- [x] `docs/prompt-plan.md` Stage 4 checklist ticked
- [x] `docs/decisions.md` ADRs recorded
- [x] `tests/README.md` test inventory updated

### 4.5 Manual Verification ✅
- [x] Checkout and successful subscription
- [x] Customer Portal
- [x] Webhook delivery
- [x] Duplicate webhook delivery (idempotency)
- [x] Cancellation
- [x] Payment failure
- [x] Retry after processing failure
- [x] Recovery of stale processing row
- [x] Service-role write to `webhook_events` confirmed

**Status**: Complete — Stage 4 closed, issues #4–#10 resolved

---

## Next Stages (TBD)

- Stage 5: Usage billing
- Stage 6: Team plans
- Stage 7: Annual plans
