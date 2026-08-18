# Implementation Plan — Lean Micro-SaaS Starter

This plan is intentionally short. Durable contracts live in `docs/schema.md` and `docs/decisions.md`; operational rationale lives in `README.md`; implementation conventions for Claude Code live in `CLAUDE.md`.

## Build Order

1. Scaffold Next.js, TypeScript strict, Tailwind, shadcn/ui, linting, formatting, environment validation, and the documented scripts.
2. Add Supabase browser/server/service-role clients with `server-only` protection; add migrations and RLS; start local Supabase and run the RLS isolation tests.
3. Add password auth, protected routes, session refresh, profile provisioning, logout, forgot-password, and recovery callback flows.
4. Add lazy Stripe Customer provisioning, Checkout, Portal, metadata ownership rules, and pinned Stripe SDK configuration.
5. Add signature-first webhook processing, atomic event claims, retryable failed state, subscription lifecycle handlers, `invoice.paid`, `invoice.payment_failed`, and unknown-event handling.
6. Add entitlement reads and billing UI. Entitlement comes only from the webhook-synced database state.
7. Add Vitest coverage for billing/auth/security/concurrency and Playwright coverage for application flows. Add local Supabase RLS tests. Do not automate live Stripe Checkout in core.
8. Document and manually deploy migrations: inspect, dry-run, push, verify, then deploy dependent application code.
9. Add optional modules only after a product requirement exists.

## Acceptance Gates

- No secret or service-role import reaches client code.
- Cross-user billing access is rejected.
- Invalid webhook signatures cause no database writes.
- Duplicate events cannot process concurrently through the atomic claim.
- Failed webhook processing returns non-2xx and can retry safely.
- Unknown event types are acknowledged without changing entitlements.
- Unknown subscription statuses are preserved and produce no access.
- `invoice.paid` keeps recurring entitlement state current.
- Password recovery works for valid and invalid/expired callbacks.
- Local RLS tests pass when Supabase is available.
- Migration ordering and destructive-reset warnings are documented.
