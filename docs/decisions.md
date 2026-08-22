# Architectural Decisions

This file records key architectural decisions for the SaaS Starterpack.

---

## Decision #1 — Next.js 15 App Router

**Date**: 2026-08-18  
**Status**: Accepted

### Context

We need a modern React framework with server-side rendering, API routes, and easy deployment.

### Decision

Use Next.js 15 with App Router for:
- Server Components by default
- File-based routing
- Built-in API routes
- Vercel deployment

### Consequences

- ✅ Fast time-to-market
- ✅ Great DX with hot reload
- ⚠️ Learning curve for App Router patterns

---

## Decision #12 — Stripe SDK Version Pinning

**Date**: 2026-08-22  
**Status**: Accepted

### Context

Stripe SDK and API versions must be kept in sync to avoid breaking changes.

### Decision

- Pin Stripe SDK to v17.x (latest stable as of 2026-08)
- Pin `STRIPE_API_VERSION=2025-11-20.acacia`
- Store version in env and validate at startup
- Upgrade SDK and API version together in lockstep

### Consequences

- ✅ Predictable behavior across deploys
- ✅ No surprise breaking changes
- ⚠️ Must manually upgrade when new version releases

---

## Decision #13 — Atomic Claim Pattern for Webhooks

**Date**: 2026-08-22  
**Status**: Accepted

### Context

Stripe webhooks can be delivered multiple times. We need idempotent processing to avoid double-charging or duplicate state updates.

### Decision

Use atomic claim pattern:

```sql
INSERT INTO webhook_events (stripe_event_id, event_type, payload, status)
VALUES ($1, $2, $3, 'pending')
ON CONFLICT (stripe_event_id) DO NOTHING;
```

- If claim returns 0 rows → duplicate → return 200 immediately
- If claim succeeds → process in transaction → mark as `processed` or `failed`

### Consequences

- ✅ Idempotent by design
- ✅ Full audit trail in `webhook_events`
- ✅ Can recover from partial failures
- ⚠️ Slightly more complex than naive approach

---

## Decision #14 — Service-Role Client for Entitlements

**Date**: 2026-08-22  
**Status**: Accepted

### Context

Entitlement checks need to read subscription status from Supabase without RLS restrictions, but must never be exposed to the browser.

### Decision

- Use service-role Supabase client in `lib/supabase/admin.ts`
- Only import in server-side code (`lib/vendor/stripe/entitlements.ts`)
- Never expose service-role key to browser

### Consequences

- ✅ Can read subscription status without RLS
- ✅ Server-side only — no security risk
- ⚠️ Must be careful not to import in client components

---

## Decision #15 — past_due Grace Period Off by Default

**Date**: 2026-08-22  
**Status**: Accepted

### Context

Stripe subscriptions can enter `past_due` status when payment fails but before cancellation. We need a policy for whether to grant access during this period.

### Decision

- Default: `past_due` → deny access (grace period off)
- Configurable via `BILLING_CONFIG.pastDueGracePeriod` in `lib/config.ts`
- Can enable grace period later if needed

### Consequences

- ✅ Conservative default — no access without payment
- ✅ Easy to enable grace period later
- ⚠️ May need to tune based on user feedback

---

## Decision #16 — Stripe Integration (Stage 4)

**Date**: 2026-08-22  
**Status**: Accepted

### Context

Full Stripe billing integration needed for subscription SaaS.

### Decision

Implement full Stripe integration:
- Checkout Sessions with `user_id` metadata
- Customer Portal for subscription management
- Webhook handler with atomic claim and idempotency
- Entitlement checks via service-role client
- Billing dashboard with live subscription status

### Files

- `lib/vendor/stripe/` — Client, checkout, portal, webhook, entitlements
- `app/api/stripe/` — Webhook, checkout, portal routes
- `app/(dashboard)/billing/` — Billing dashboard
- `app/(marketing)/pricing/` — Pricing page

### Consequences

- ✅ Full subscription billing flow
- ✅ Idempotent webhook processing
- ✅ Server-side entitlement checks
- ⚠️ Requires Stripe account and webhook setup
