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

| File                    | What it covers                                                                                     | Status                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `config.test.ts`        | `APP_CONFIG` and `BILLING_CONFIG` shape and field presence                                          | ✅ Passing                                                        |
| `entitlements.test.ts`  | `hasActiveSubscription()` for every subscription status; `requireActiveSubscription()` redirects; `past_due` default-deny policy | ✅ Passing                                    |
| `env.test.ts`           | `lib/env.ts` Zod schema — accepts valid env, rejects missing/invalid vars                           | ✅ Passing                                                        |
| `nav.test.ts`           | `MARKETING_NAV` and `DASHBOARD_NAV` shape, label uniqueness, group isolation                        | ✅ Passing                                                        |
| `rls.test.ts`           | RLS policy documentation — asserts expected policy behaviour for `profiles` and `subscriptions`     | ✅ Passing                                                        |
| `webhook.test.ts`       | `POST /api/stripe/webhook` — signature validation, idempotency (duplicate/claim), event routing for all 5 entitlement events, unknown-event handling, handler-error path | ✅ Passing — stale-processing recovery (`updated_at` > 10 min) not yet covered, see #9 |
| `billing.test.ts`       | Subscription fixture coverage (7 DB statuses), `BILLING_CONFIG.pastDueGracePeriod` policy           | ✅ Passing — checkout metadata test asserts a local mock object, not the real `createCheckoutSession()` contract, see #9 |
| `checkout.test.ts`      | `POST /api/stripe/checkout` — auth guard, `createCheckoutSession` call args, price ID fallback, redirect, error handling | ✅ Passing                                    |
| `portal.test.ts`        | `POST /api/stripe/portal` — auth guard, missing-customer handling, `createPortalSession` call args, redirect, error handling | ✅ Passing                                    |

**Current status:** 9 active suites, all passing ✅ — see `npm test` output for the exact test count.
**Known gaps (tracked in issue #9):** stale-processing recovery has no test coverage; the checkout metadata contract isn't verified against the real implementation.
**Coverage targets:** Auth 100% · Webhooks 90% · Entitlements 100% · RLS 80%

---

## Fixtures

Shared typed test data lives in `tests/fixtures/`. Always use fixtures instead of inline object literals.

| File                         | What it provides                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixtures/subscriptions.ts`  | `MockSubscription` type + `subscriptionFixtures` record covering all 8 statuses (`active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`) |
| `fixtures/webhook-events.ts` | Plain-object Stripe event payloads for all 5 entitlement-controlling events + `ignoredEventFixtures` for events the handler must swallow without crashing                              |

**Rule:** if the database schema adds a new `subscription_status` enum value, add a matching fixture here. TypeScript will tell you — `subscriptionFixtures` is typed as `Record<SubscriptionStatus, MockSubscription>`.

---

## Setup file

`tests/setup.ts` runs before every test file (configured via `vitest.config.ts` `setupFiles`).

It stubs the required env vars so `lib/env.ts` doesn't crash at import time:

```ts
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
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
- Test filenames match the module or route: `lib/entitlements.ts` → `tests/entitlements.test.ts`, `app/api/stripe/checkout/route.ts` → `tests/checkout.test.ts`
- Use fixtures from `tests/fixtures/` — never inline subscription or event objects
- Descriptive `describe` + `it` blocks — error messages should read like sentences
- A test that asserts against a locally-constructed mock object instead of calling the real module isn't coverage — call the real function and mock only its dependencies

---

## Open items (issue #9)

- `webhook.test.ts` — add a case for stale-processing recovery (`updated_at` older than 10 minutes gets reset to `pending`); no code currently exercises this, it's documented as a manual/scheduled SQL query in the [README](../README.md#stripe-webhook-failures)
- `billing.test.ts` — replace the mock-metadata assertion with a real call to `createCheckoutSession()` (mocking only `getStripe()`) to verify `metadata.user_id` is actually set
