# CLAUDE.md

## Mission

Build and maintain a reusable, product-agnostic micro-SaaS starter for a solo developer. Prefer the smallest boring solution that is secure, testable, and easy to delete or replace. Do not implement product-specific workflows in the starter.

## Stack

- Next.js App Router + TypeScript strict
- Supabase Auth, PostgreSQL, `@supabase/ssr`, generated database types
- Stripe Checkout, Customer Portal, and verified webhooks
- Vercel deployment
- Vitest for unit/integration tests; Playwright for application flows
- SQL migrations managed manually through Supabase CLI

## Non-Negotiable Security Rules

- Never import the service-role Supabase client into client code or any client-reachable module.
- Service role is limited to the webhook route and narrowly scoped server-only billing repository.
- Verify Stripe webhook signatures against the raw body before parsing or database access.
- Derive checkout and portal ownership from the authenticated server session, never a client-supplied user ID or customer ID.
- Enforce RLS through migrations and test cross-user isolation against local Supabase.
- Never grant entitlement from a redirect, client state, or optimistic write.

## Billing Implementation Rules

- Provision Stripe Customers lazily and use the local unique constraint for concurrency safety. Do not describe this as strict external API idempotency.
- Use an atomic event-ID claim (`INSERT ... ON CONFLICT DO NOTHING`), not a read-then-insert ledger check.
- Track `processing`, `processed`, and `failed` states. Return 2xx only after successful processing; failed attempts must be retryable.
- Handle subscription lifecycle events, `invoice.paid`, and `invoice.payment_failed`. Preserve unknown subscription statuses and resolve them to no access.
- Keep webhook handlers idempotent with stable subscription-key upserts.

## Scope Boundaries

Do not add organizations, usage billing, queues, Redis, ORM, microservices, embedded Stripe Elements, or provider-specific auth UI unless a concrete product requires them. Organization billing requires schema and RLS migration work; do not make a resolver-only change.

## Change Workflow

1. Read `README.md`, `docs/schema.md`, and `docs/decisions.md`.
2. Inspect existing code before changing it.
3. Make the smallest coherent change.
4. Update migrations for schema changes; never edit the database manually as the source of truth.
5. Add or update tests for security, billing, auth, and concurrency behavior.
6. Run typecheck, lint, Vitest, and relevant Playwright/local-RLS tests.
7. Review the diff for secret exposure, client imports, ownership bypasses, and contradictory documentation.

## Migration Safety

`supabase db reset` is destructive and local-only. For remote deployment: inspect `supabase migration list`, run `supabase db push --dry-run`, review, then run `supabase db push`. Apply migrations before deploying code that depends on them.

## Documentation Rule

Keep durable schema and decisions in `docs/`. Keep usage, setup, operations, and rationale in `README.md`. Keep implementation constraints and agent instructions here. Update all three when a change affects more than one concern.
