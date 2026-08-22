# Test Suite Documentation

## Overview

This project uses Vitest for testing with a comprehensive suite covering:
- Authentication flows
- Billing and webhook processing
- Checkout and portal sessions
- Entitlement logic
- Configuration validation
- Navigation and RLS policies

## Test Inventory

### Core Tests

| File | Coverage Target | Status |
|------|----------------|--------|
| `env.test.ts` | 100% | ✅ Complete |
| `config.test.ts` | 100% | ✅ Complete |
| `auth.test.ts` | 90% | ✅ Complete |
| `nav.test.ts` | 85% | ✅ Complete |
| `rls.test.ts` | 95% | ✅ Complete |

### Billing Tests (Stage 4)

| File | Coverage Target | Status |
|------|----------------|--------|
| `checkout.test.ts` | 90% | ✅ Complete |
| `portal.test.ts` | 90% | ✅ Complete |
| `webhook.test.ts` | 90% | ✅ **Activated** |
| `billing.test.ts` | 90% | ✅ **Activated** |
| `entitlements.test.ts` | 100% | ✅ Complete |

### Webhook Tests (`webhook.test.ts`)

**Activated test cases:**
- ✅ Idempotency: duplicate `stripe_event_id` → 200, no double-process
- ✅ Event routing for all 5 entitlement events:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- ✅ Stale-processing recovery (`updated_at > 10 min` threshold)
- ✅ Invalid Stripe signature → 400
- ✅ Transaction rollback on processing failure

### Billing Tests (`billing.test.ts`)

**Activated test cases:**
- ✅ Checkout session contract (includes `user_id` in metadata)
- ✅ Status mapping for all 7 DB statuses (`active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired`)
- ✅ `past_due` denied by default via `BILLING_CONFIG`
- ✅ `requireActiveSubscription()` redirects non-premium users

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test webhook.test.ts

# Validate (lint + typecheck + test)
npm run validate
```

## Test Patterns

### Mocking Strategy

- **Stripe**: All Stripe SDK calls are mocked using `vi.mock()`
- **Supabase**: Database calls use mocked admin client
- **No real credentials**: Tests never use live Stripe or Supabase credentials

### Fixture Data

Test fixtures are stored in `tests/fixtures/`:
- `webhook-events/` - Sample Stripe webhook payloads
- `subscriptions.ts` - Mock subscription data
- `profiles.ts` - Mock user profile data

## Coverage Goals

- **Entitlements**: 100% (all subscription statuses covered)
- **Webhook handler**: 90% (all event types, idempotency, recovery)
- **Checkout/Portal**: 90% (session creation, redirects, error cases)
- **Overall**: 85%+ across all test files
