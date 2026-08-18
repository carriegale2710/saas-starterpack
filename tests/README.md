# Tests

Vitest unit test suite for the SaaS Starter template.

## Running tests

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

CI runs all three jobs on every push and PR via `.github/workflows/ci.yml`.

---

## Test files

| File | What it covers | Status |
|---|---|---|
| `config.test.ts` | `APP_CONFIG` and `BILLING_CONFIG` shape and field presence | ✅ Passing |
| `entitlements.test.ts` | `hasActiveSubscription()` for every subscription status; `past_due` default-deny policy | ✅ Passing |
| `env.test.ts` | `lib/env.ts` Zod schema — accepts valid env, rejects missing/invalid vars | ✅ Passing |
| `nav.test.ts` | `MARKETING_NAV` and `DASHBOARD_NAV` shape, label uniqueness, group isolation | ✅ Passing |
| `rls.test.ts` | RLS policy documentation — asserts expected policy behaviour for `profiles` and `subscriptions` | ✅ Passing |
| `webhook.test.ts` | Idempotency logic, event routing contracts, stale-processing recovery threshold | 🔜 Skeleton — fills in as Phase 2 webhook handler is built |
| `billing.test.ts` | Checkout session contract, subscription fixture coverage, `BILLING_CONFIG` policy | 🔜 Skeleton — fills in as Phase 2 billing code is built |

**Current status:** 5 active suites · 20 passing tests ✅  
**Skeleton suites:** 2 (webhook, billing) — contracts defined, assertions activate as implementation lands

---

## Fixtures

Shared typed test data lives in `tests/fixtures/`. Always use fixtures instead of inline object literals.

| File | What it provides |
|---|---|
| `fixtures/subscriptions.ts` | `MockSubscription` type + `subscriptionFixtures` record covering all 8 statuses (`active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`) |
| `fixtures/webhook-events.ts` | Plain-object Stripe event payloads for all 5 entitlement-controlling events + `ignoredEventFixtures` for events the handler must swallow without crashing |

**Rule:** if the database schema adds a new `subscription_status` enum value, add a matching fixture here. TypeScript will tell you — `subscriptionFixtures` is typed as `Record<SubscriptionStatus, MockSubscription>`.

---

## Setup file

`tests/setup.ts` runs before every test file (configured via `vitest.config.ts` `setupFiles`).

It stubs the required env vars so `lib/env.ts` doesn't crash at import time:

```ts
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
```

**Rule:** if `lib/env.ts` adds a new required variable (e.g. Stripe vars in Phase 2), add a matching stub here AND in `.github/workflows/ci.yml` `env:`. Never put real API keys in either file.

---

## CI

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs 3 jobs:

```
validate (lint + typecheck) ~30s
    ├── build (Next.js build)    ~60s  ─┐ parallel
    └── test (vitest + coverage) ~30s  ─┘
```

- `validate` runs first — fast feedback on obvious errors
- `build` and `test` run in parallel after validate passes
- All three must be green before merging

---

## Conventions

- Unit tests only — no network calls, no real Supabase or Stripe connections
- Import the module under test directly; mock only what crosses a network or filesystem boundary
- Test filenames match the module: `lib/entitlements.ts` → `tests/entitlements.test.ts`
- Use fixtures from `tests/fixtures/` — never inline subscription or event objects
- Descriptive `describe` + `it` blocks — error messages should read like sentences
- Skeleton tests use comments to mark where assertions will be added: `// When implemented: ...`

---

## Phase 2 planned additions

- `webhook.test.ts` — fill in handler invocation tests as `lib/vendor/stripe/webhook.ts` is built
- `billing.test.ts` — fill in checkout/portal session tests as `lib/vendor/stripe/checkout.ts` and `portal.ts` are built
- `tests/fixtures/` — extend as new Stripe event types are needed
- Coverage thresholds in CI tightened to 90%+ for webhook handlers once implemented
