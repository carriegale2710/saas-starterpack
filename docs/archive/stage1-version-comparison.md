# Stage 1 Version Comparison: Claude Iterations vs Final Starter

Stage 1 in `docs/prompt-plan.md` was redone in Perplexity Pro and rewrote over original files generated in first pass by Claude. Before proceeding I have asked Perplexity to justify the changes to the files below. Earlier information from previous files have been condensed into `docs/archive/reference-only.md` for preservation for later stages where they made be useful.

## Verdict

For a solo developer, the **latest Claude-oriented iteration is the better baseline**.

The earlier generated files are useful as a broad architecture draft, but they should not be treated as the final implementation contract. The latest set is smaller, more internally consistent, and safer around billing, ownership, migrations, and testing.

## Similarities

Both iterations preserve the required foundation:

- Next.js App Router and TypeScript strict mode.
- Tailwind CSS and shadcn/ui-style components.
- Supabase PostgreSQL, Auth, generated types, and RLS.
- Stripe Checkout, Customer Portal, subscriptions, and verified webhooks.
- Vercel deployment.
- A modular monolith rather than microservices.
- No Prisma, Drizzle, Redux, GraphQL, Redis, Docker, or separate backend.
- Product configuration and environment validation.
- User-owned billing in the core design.
- Optional modules excluded from the default starter.
- Webhooks as the billing correctness source and a local database read model for fast entitlement checks.
- Service-role credentials restricted to server-side code.
- Password recovery included.
- Documentation split across implementation plan, schema, decisions, README, and CLAUDE.md.

## Major Differences

### 1. Database model

The earlier schema uses three main tables:

- `profiles`.
- `subscriptions`.
- `webhook_events`.

The latest schema uses four focused tables:

- `profiles`.
- `customers`.
- `subscriptions`.
- `stripe_events`.

The addition of `customers` is the important improvement. It cleanly models the user-to-Stripe-Customer relationship and supports lazy customer provisioning for Checkout and Portal. The earlier design placed `stripe_customer_id` directly on `subscriptions`, which becomes awkward when a user has no subscription yet or has historical subscriptions.

The latest schema also uses the Stripe subscription ID as the subscription primary key. That reduces an unnecessary local UUID and makes webhook upserts naturally idempotent.

**Better:** Latest iteration.

### 2. Customer provisioning

The earlier version implicitly creates or resolves customer information around subscription creation. It does not clearly define a customer table or the no-subscription case.

The latest version explicitly decides:

- Do not create a Stripe Customer at signup.
- Create it lazily on first Checkout or Portal use.
- Keep the operation in a server-only billing repository.
- Use a local unique constraint and insert-on-conflict/re-read.
- Accept and document the rare possibility of an unused orphan Stripe Customer from an external API race.

**Better:** Latest iteration. It is simpler on the auth path and more honest about concurrency limits.

### 3. Webhook idempotency

The earlier schema describes a `webhook_events` table with `pending`, `processing`, `processed`, and `failed` states, but its proposed claim query is a status-based update. It also includes a partial unique index on `stripe_event_id` where status is `pending`, which adds little value because the event ID is already globally unique.

The latest iteration specifies:

- Verify the raw signature first.
- Claim with `INSERT ... ON CONFLICT DO NOTHING`.
- Never use a read-then-insert check.
- Track `processing`, `processed`, and `failed`.
- Return 2xx only after successful processing.
- Return non-2xx after failure so Stripe retries.
- Record unknown event types safely.

**Better:** Latest iteration. The claim primitive is clearer and the HTTP retry behavior is explicit.

### 4. Stripe event coverage

The earlier version covers the key lifecycle events and `invoice.paid`, but is less precise about failed processing and unknown statuses.

The latest version explicitly includes:

- `checkout.session.completed`.
- `customer.subscription.created`.
- `customer.subscription.updated`.
- `customer.subscription.deleted`.
- `invoice.paid`.
- `invoice.payment_failed`.
- Unknown event acknowledgement after recording.
- Unknown subscription statuses preserved and mapped to no access.

It also explicitly says that returning from Checkout never grants access by itself.

**Better:** Latest iteration.

### 5. Entitlements

The earlier version defines statuses such as `active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete`, and `incomplete_expired`. It suggests `past_due` may receive read-only or grace-period access.

The latest version leaves the product entitlement policy to the local read model while making the security default explicit: unknown statuses produce no access. It also adds reusable APIs such as `getCurrentSubscription`, `getCurrentEntitlements`, `hasEntitlement`, and `requireEntitlement`.

The latest version is better architecturally because it separates subscription state from product feature entitlements. However, it should still explicitly document whether `past_due` receives full, limited, or no access for each product. That policy should live in central product configuration, not be hard-coded in generic billing code.

**Better:** Latest iteration, with one clarification still required: define the default `past_due` policy.

### 6. Service-role boundaries

The earlier version says the service-role key is server-only and concentrates it in the webhook route, but its RLS examples are not fully reliable. In particular, a policy such as `USING (auth.uid() IS NULL)` is not the right way to model service-role access because the service role bypasses RLS rather than needing a user-facing policy.

The latest version is more precise:

- Service role is limited to the webhook route and narrow server-only billing repository.
- It must never enter client-reachable modules.
- Checkout and Portal ownership come from the authenticated server session.
- Client-supplied user or customer IDs are rejected as authority.
- RLS is tested against local Supabase.

**Better:** Latest iteration. Remove user-facing policies from privileged tables and rely on service-role bypass explicitly.

### 7. Migration workflow

The earlier README recommends `supabase db push` and documents `supabase db reset`, but it does not clearly distinguish local destructive reset from remote deployment.

The latest version defines a safer sequence:

```bash
supabase migration list
supabase db push --dry-run
supabase db push
```

It explicitly states that `supabase db reset` is local-only and destructive, and that migrations must be applied before deploying dependent application code.

**Better:** Latest iteration.

### 8. Testing

The earlier version mainly uses Vitest and gives percentage targets. It does not include a dedicated browser-flow strategy.

The latest version uses:

- Vitest for unit and integration tests.
- Playwright for application-owned browser flows.
- Local Supabase RLS isolation tests.
- Mocked Stripe and Supabase in CI.
- Manual Stripe CLI checks instead of automating Stripe-hosted Checkout.

This is a better solo-developer balance. It tests the application without making CI depend on third-party hosted UI or production credentials.

**Better:** Latest iteration.

### 9. Documentation and workflow

The earlier files are broad architecture documents. They contain a large dependency audit and extensive alternatives, but are somewhat repetitive and include implementation examples that can be mistaken for final code contracts.

The latest set separates concerns more cleanly:

- `implementation-plan-3.md`: short sequence and gates.
- `schema-4.md`: data contract.
- `decisions-2.md`: accepted decisions and explicit trade-offs.
- `README-6.md`: operational setup and deployment.
- `CLAUDE-5.md`: implementation and security rules.
- `prompt-plan.md`: staged Claude workflow with local verification and escalation points.

The addition of `prompt-plan.md` is particularly useful for a solo developer using Claude Free because it bounds context, separates research from implementation, and creates Git checkpoints.

**Better:** Latest iteration.

## Earlier Version Strengths

The earlier generated files should not be discarded entirely. They are stronger in these areas:

- More detailed dependency justification, including why Zod, Vitest, Tailwind utilities, and icon libraries are used.
- More explicit high-level architectural alternatives such as microservices, separate backends, ORMs, Redis, and component libraries.
- A more visible initial phase breakdown for foundation, billing, and deployment.
- A clearer first-pass explanation of core product configuration and vendor isolation.

These are useful as rationale, but they are more verbose and less precise in the parts that matter most for billing correctness.

## Latest Version Strengths

The latest Claude-oriented set is stronger in the areas most likely to cause a solo developer expensive mistakes:

- Correctly separates Stripe Customers from subscriptions.
- Makes lazy customer provisioning explicit.
- Avoids pretending local uniqueness gives strict external Stripe API idempotency.
- Uses atomic event claiming rather than read-then-insert.
- Defines failed webhook response behavior for Stripe retries.
- Preserves unknown statuses and denies access safely.
- Treats `invoice.paid` as entitlement-controlling.
- Separates Stripe correctness from the local entitlement read model.
- Adds Playwright only for application-owned flows.
- Provides a safe manual migration sequence.
- Explicitly documents that organization billing is a schema/RLS migration, not a simple resolver abstraction.
- Adds the staged `prompt-plan.md`, which is valuable when Claude Free context is limited.

## Remaining Issues to Fix Before Calling It Final

The latest iteration is better, but it still needs a small cleanup pass:

1. **Choose one package manager.** The latest README uses `npm`, while the prompt plan recommends `pnpm`. Pick one and make every command, lockfile, and CI instruction consistent. For a solo developer, use `pnpm` only if you already prefer it; otherwise `npm` is simpler because it is preinstalled with Node.

2. **Use one naming convention.** The latest files alternate between `stripe_events` and `webhook_events`, and between `src/lib` and `lib`. Choose one canonical convention. For a small Next.js starter, `lib/` is acceptable; `src/` is also fine, but do not mix them.

3. **Make webhook processing atomic at the database transaction boundary.** `INSERT ... ON CONFLICT DO NOTHING` is the correct event claim, but the event state update and subscription upsert should be designed so a crash cannot leave a permanently misleading `processing` row. Document stale-processing recovery or use a transaction plus an explicit retry policy.

4. **Define the `past_due` entitlement policy.** Do not leave this as a generic “grace period” rule. Put the decision in central product configuration. The safest generic default is no premium access unless the product deliberately chooses a grace period.

5. **Pin compatible SDK versions, not only an environment API string.** Pin the Stripe Node SDK in `package.json`, record the Stripe API version in configuration, and test upgrades deliberately.

6. **Avoid claiming that every optional module has no core-table impact.** Workspaces and usage billing can require relationships or billing-owner changes. The latest version correctly acknowledges this; preserve that warning.

7. **Correct the database RLS documentation.** Service-role access should be described as bypassing RLS, not granted through `auth.uid() IS NULL` policies. Privileged tables should have no authenticated-user policies.

8. **Add a real initial migration rather than only prose SQL.** The schema document is authoritative, but the repository should contain numbered migrations before implementation begins.
