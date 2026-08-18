# Tests

Vitest unit test suite for the SaaS Starter template.

## Running tests

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

CI runs `npm test` on every push and PR via `.github/workflows/ci.yml`.

---

## Test files

| File | What it covers |
|---|---|
| `config.test.ts` | `APP_CONFIG` and `BILLING_CONFIG` shape and field presence |
| `entitlements.test.ts` | `hasActiveSubscription()` for every subscription status; `past_due` default-deny policy |
| `env.test.ts` | `lib/env.ts` Zod schema — accepts valid env, rejects missing/invalid vars |
| `nav.test.ts` | `MARKETING_NAV` and `DASHBOARD_NAV` shape, label uniqueness, group isolation |
| `rls.test.ts` | RLS policy documentation — asserts expected policy behaviour for `profiles` and `subscriptions` |

**Current status:** 5 suites · 20 tests · all passing ✅

---

## Setup file

`tests/setup.ts` runs before every test file (configured via `vitest.config.ts` `setupFiles`).

It stubs the four required env vars so `lib/env.ts` doesn't crash at import time:

```ts
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
```

**Rule:** if `lib/env.ts` adds a new required variable, add a matching stub here. Never put real API keys in this file.

---

## Conventions

- Unit tests only — no network calls, no real Supabase or Stripe connections
- Import the module under test directly; mock only what crosses a network or filesystem boundary
- Test filenames match the module: `lib/entitlements.ts` → `tests/entitlements.test.ts`
- Descriptive `describe` + `it` blocks — error messages should read like sentences

---

## Planned additions (Phase 2)

- `webhook.test.ts` — webhook handler logic, including transaction rollback scenario
- `billing.test.ts` — Stripe Checkout session creation
- Test fixtures for all subscription states in `tests/fixtures/`
