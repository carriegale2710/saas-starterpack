# Decisions Record

This document records the architectural decisions for the reusable solo-developer micro-SaaS starter. It is authoritative for decisions; implementation conventions belong in `CLAUDE.md`, and operational instructions belong in `README.md`.

## 1. Testing Depth

**Decision:** Use Vitest for unit and integration tests, including mocked Stripe SDK flows, webhook handlers, atomic claim/retry behavior, entitlement mapping, authentication helpers, and security-sensitive request validation. Use Playwright for application-owned browser flows: signup, login, logout, route protection, forgot-password, and password recovery. Do not automate live Stripe-hosted Checkout in core. Provide a manual Stripe CLI verification runbook instead.

**Trade-off:** This avoids flaky third-party UI tests and live credentials in CI while still testing the application logic. A manual Stripe verification step remains necessary before major billing changes or launch.

## 2. Stripe Customer Provisioning

**Decision:** Provision Stripe Customers lazily, only when an authenticated user first uses Checkout or the Customer Portal. Never provision at signup. Keep `getOrCreateStripeCustomer(userId)` in a narrowly scoped server-only billing repository.

**Concurrency rule:** Use the local unique constraint on `customers.user_id` with insert-on-conflict followed by a re-read. This guarantees one local mapping. It does not provide strict external Stripe API idempotency: a rare concurrent race can create one orphaned, unused Stripe Customer. No distributed lock is included in core. Store `metadata.userId` to support ownership recovery and cleanup.

**Trade-off:** Signup remains simpler and avoids a Stripe dependency in the auth path. First billing use has one extra API call and a rare cleanup edge case.

## 3. Authentication Scope

**Decision:** Ship an email/password-only initial UI, including forgot-password and password-recovery callback flows. Keep the auth form extensible for future magic-link or OAuth methods, but do not include provider-specific UI or configuration in core.

**Trade-off:** The core auth surface stays small and product-agnostic. Adding another provider later is additive UI and Supabase configuration work.

## 4. Billing Ownership

**Decision:** Core billing is strictly user-owned. `customers.user_id` and `subscriptions.user_id` reference `auth.users.id`. Do not include a premature `getBillingOwnerId` abstraction in core.

**Future organization warning:** Organization billing is not a resolver-only change. It requires a schema migration, data migration, foreign-key redesign or replacement, and a complete RLS policy rewrite. A workspace ID cannot be returned through the current user-scoped code and schema without those changes. Add a billing-owner abstraction as part of the future organization-billing migration when it is genuinely needed.

**Trade-off:** Core RLS and billing code remain easier to understand. Future teams billing has a larger migration, but that complexity is not paid before a product requires it.

## 5. Migration Application

**Decision:** Apply Supabase migrations manually. Before a remote push, inspect `supabase migration list`, run `supabase db push --dry-run`, review the result, and then run `supabase db push`. Apply migrations before deploying application code that depends on them.

`supabase db reset` is local-only and destructive: it drops and recreates the local database. It must never be used as a remote deployment procedure.

**Trade-off:** This avoids premature production migration automation and keeps credentials out of CI. The cost is migration drift risk, mitigated by the documented command sequence and a future approval-gated CI workflow as an explicit follow-up.

## 6. Billing and Webhook Correctness

**Decision:** Verify the Stripe signature before parsing or touching the database. Claim event IDs atomically with `INSERT ... ON CONFLICT DO NOTHING`; never use a read-then-insert ledger check. Track `processing`, `processed`, and `failed` states. Return 2xx only after successful processing; return non-2xx after failure so Stripe can retry.

Handle `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. Unknown event types are safely acknowledged after being recorded. Unknown subscription statuses are preserved and resolve to no access.

## 7. Architecture Scope

**Decision:** Use a single Next.js modular monolith with Supabase, Stripe, and Vercel. Keep optional features such as teams, usage billing, storage, email, analytics, Sentry, AI integrations, and background jobs outside the core until a concrete product requirement exists.

Do not add an ORM, Redis, a queue, microservices, GraphQL, or embedded Stripe Elements speculatively.
