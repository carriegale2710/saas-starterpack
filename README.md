# Micro-SaaS Starter

A reusable Next.js, Supabase, Stripe, and Vercel starter for solo developers shipping subscription SaaS products.

## What This Provides

- Next.js App Router and TypeScript modular monolith
- Supabase Auth, PostgreSQL, generated types, and RLS
- Stripe-hosted Checkout and Customer Portal
- Webhook-driven subscription entitlements
- Vitest unit/integration tests and Playwright application-flow tests
- Manual Supabase migration deployment

## Architecture

Keep product code inside the application and keep infrastructure boring: Server Components, Server Actions, and Route Handlers talk directly to Supabase and Stripe. Do not add an ORM, queue, Redis, microservice, or embedded card UI until a real product requirement justifies it.

Stripe is the billing-state source of truth; the local subscription table is the read model used for fast entitlement checks. Never grant access from a Checkout redirect.

## Billing Rules

- Checkout and Portal requests require a server-verified authenticated user.
- Stripe Customers are provisioned lazily on first Checkout or Portal use.
- `customers.user_id` is unique, but a rare concurrent first-use race may leave one unused Stripe Customer orphan in Stripe; this is accepted and should be cleaned up manually if encountered.
- Webhooks verify the raw request signature before database access, atomically claim event IDs, retry failed processing, and return success only after processing completes.
- Entitlement-controlling events are subscription lifecycle events plus `invoice.paid` and `invoice.payment_failed`.

## Authentication

The initial UI is email/password only. Forgot-password sends a generic confirmation, and the recovery callback exchanges the Supabase code before allowing a password update. Keep the auth form extensible for later magic-link or OAuth additions.

## Local Development

```bash
npm install
supabase start
supabase db reset
npm run dev
```

`supabase db reset` is destructive: it drops and recreates the local database. Never use it as a remote deployment command.

## Migrations

Apply migrations manually and before deploying code that depends on them:

```bash
supabase migration list
supabase db push --dry-run
supabase db push
```

Review the dry run. Confirm the migration list after deployment.

## Testing

Run unit/integration tests and application-flow tests before merging. Run local Supabase RLS tests whenever Supabase is available. The core suite does not automate live Stripe-hosted Checkout; use the documented Stripe CLI/manual verification procedure before major billing changes or launch.

## Stripe SDK

Pin the Stripe SDK version in `package.json`. Record the configured Stripe API/webhook version in the project documentation and upgrade deliberately with webhook regression tests.

## Future Organizations

Core billing is user-owned. Organization billing is not a resolver-only change: it requires a schema migration, data migration, and RLS policy rewrite. Add a billing-owner abstraction as part of that future work rather than pretending the current `auth.users` foreign keys accept workspace IDs.

## Source of Truth

- Stable database contract: `docs/schema.md`
- Architectural decisions: `docs/decisions.md`
- Coding and agent conventions: `CLAUDE.md`
- Product-agnostic implementation guidance: this README
