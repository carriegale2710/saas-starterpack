# Prompt Plan — Perplexity Pro + Claude Free + Local Tools

Use an **eight-stage workflow**. Each stage has a defined tool assignment:

- **Perplexity Pro** — research, architecture, decisions, vendor guidance, independent review
- **Claude Free** — bounded, single-purpose implementation tasks and code generation
- **Local tools** — Git, VS Code, Supabase CLI, Stripe CLI, Vitest, Playwright, and the test suite

Claude Free works best with a single focused task per session. Keep each prompt scoped to one stage. Never ask Claude Free to research, decide architecture, or review external APIs — use Perplexity Pro for that.

---

## Project conventions

These conventions apply throughout every stage and every document:

- Use **npm exclusively**. Do not use pnpm or yarn.
- Commit `package-lock.json`; do not commit `pnpm-lock.yaml` or `yarn.lock`.
- Use `lib/` as the canonical application-library directory. Never use `src/lib/`.
- Use `webhook_events` as the canonical webhook table name. Never use `stripe_events`.
- The initial database migration is `supabase/migrations/0001_initial.sql`.
- The service-role key bypasses RLS entirely. Do not create `auth.uid() IS NULL` policies to simulate service-role access.
- `past_due` denies premium access by default. The decision is controlled centrally by `lib/config.ts`.
- Pin the Stripe Node SDK in `package.json` and record the Stripe API version in `STRIPE_API_VERSION`.
- Workspaces and usage-based billing may require core-table relationships or billing-owner changes; they are not automatically schema-neutral.

---

## Documentation layout

The architecture stage produces a split documentation set:

- `docs/implementation-plan.md` — concise execution checklist
- `docs/schema.md` — authoritative database contract
- `docs/decisions.md` — approved architectural choices
- `README.md` — setup, operations, migration, deployment, and rationale
- `CLAUDE.md` — implementation conventions and non-negotiable security rules

The repository must also contain:

- `supabase/migrations/0001_initial.sql` — real initial migration
- `package-lock.json` — npm dependency lockfile

Later stages must read the relevant split documents and update all affected files when implementation changes a decision or contract.

---

## Tool assignment by stage

| Stage                 | Perplexity Pro                          | Claude Free                         | Local tools                                     |
| --------------------- | --------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| Architecture plan     | Draft architecture, research vendors    | —                                   | Review docs in VS Code                          |
| Foundation            | Verify current Next.js and npm guidance | Scaffold app, config, shell, layout | `npm run dev`, lint, build                      |
| Supabase auth/RLS     | Check SSR approach and current SDK docs | Implement auth, migrations, RLS     | `npx supabase db reset`, type generation, tests |
| Stripe billing        | Verify webhook events and SDK version   | Implement billing, webhooks, gates  | `stripe listen`, Vitest                         |
| Optional integrations | Research module setup if needed         | Implement selected modules only     | Environment toggle tests, build                 |
| Testing/docs          | Review documentation accuracy           | Add missing tests, fix docs         | Vitest, Playwright, build                       |
| Security review       | Independent security audit              | Fix confirmed critical/high issues  | Full test suite, `git diff`                     |
| Final validation      | —                                       | Final release-readiness sweep       | Clean checkout, all checks                      |

---

## Per-stage workflow

For every stage, follow this loop:

1. **Perplexity Pro** — research current requirements, vendor docs, and breaking changes. Update `docs/` if a decision changes.
2. **Claude Free** — provide only the current stage prompt and relevant documentation. Ask it to inspect the repository before editing.
3. **Local tools** — run tests and verification commands. If failures occur, return the exact output and relevant files to Claude Free.
4. **Perplexity Pro, if needed** — independently review issues involving Stripe, Supabase, RLS, security, or current external APIs.
5. **Git** — review `git diff` before committing.

---

## Claude Free: bounded sessions

Claude Free has a context limit. Stay within it by:

- Pasting only the relevant section of `docs/implementation-plan.md`
- Providing a schema excerpt instead of the entire schema document
- Asking for one stage at a time
- Pasting failing test output verbatim
- Starting a new session for each stage

If Claude Free reaches its limit mid-stage, split the remaining work into a second prompt. Never try to recover a broken context.

---

## When to escalate to Perplexity Pro

Use Perplexity Pro before returning to Claude Free when:

- A Supabase SSR, cookie, or middleware error appears
- A Stripe webhook event name or field is uncertain
- RLS policies behave unexpectedly
- A test failure involves an external API contract
- A security question arises that Claude Free cannot reliably answer

Perplexity Pro is the source of truth for current external APIs. Claude Free is the source of truth for the code already in the repository.

---

## When Claude Pro becomes worthwhile

Consider upgrading Claude Free to Claude Pro when:

- Claude Free repeatedly hits limits during one implementation stage
- More time is spent reconstructing context than writing code
- Long multi-file debugging sessions are required
- You want Claude Code to inspect, edit, test, and iterate in one workflow
- You are actively shipping multiple SaaS products every week

> Complete Stage 2 with the current combination first. If free-tier limits materially slow you down during Stage 3 or Stage 4, buy Claude Pro for one month and reassess.

---

## Recommended Git checkpoints

```bash
git add docs/implementation-plan.md docs/schema.md docs/decisions.md README.md CLAUDE.md
git commit -m "stage 1: architecture plan"

git add .
git commit -m "stage 2: project foundation"

git add .
git commit -m "stage 3: Supabase authentication"

git add .
git commit -m "stage 4: Stripe billing"

git add .
git commit -m "stage 5: optional integrations"

git add .
git commit -m "stage 6: testing and documentation"

git add .
git commit -m "stage 7: security review"

git add .
git commit -m "stage 8: final validation"
```

Safer commit pattern:

```bash
git diff --stat
git diff
npm run validate
git add .
git commit -m "Describe the completed stage"
```

---

## Before starting

### Step 1: Create the repository

```bash
mkdir my-saas-template
cd my-saas-template
git init
```

### Step 2: Run Perplexity Pro first (Stage 1)

Use Perplexity Pro to draft the architecture documentation. Save the output to `docs/`. Do not open a Claude Free session until these files exist and are reviewed:

- `docs/implementation-plan.md`
- `docs/schema.md`
- `docs/decisions.md`
- `README.md`
- `CLAUDE.md`

---

# Stage 1: Architecture

**Perplexity Pro stage — do not use Claude Free here.**

## Purpose

Produce architecture documentation without writing application code.

## Perplexity Pro prompt

```text
You are the lead engineer designing a reusable starter repository for lean, subscription-based micro-SaaS applications.

Do not write application code.

Design the smallest maintainable modular monolith for solo-founder SaaS products.

## Required core stack

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui-style components
- Supabase PostgreSQL
- Supabase Auth
- Supabase Row Level Security
- Stripe subscriptions
- Vercel deployment
- npm as the only package manager

## Core features only

Mandatory:
- Public marketing page
- Authentication
- Protected dashboard
- User profile
- Supabase database access
- Row Level Security
- Stripe Checkout
- Stripe Customer Portal
- Stripe webhook synchronization
- Subscription entitlements
- Central product configuration
- Environment validation
- Basic tests
- README and CLAUDE.md
- Real initial migration at supabase/migrations/0001_initial.sql

Optional modules:
- Workspaces and teams
- Usage-based billing
- Supabase Storage
- Resend
- PostHog
- Sentry
- AI integrations
- Background jobs

Do not include optional modules by default.

## Architectural principles

- Modular monolith
- Minimize dependencies
- Use npm exclusively
- Use lib/ as the canonical application-library directory
- Use webhook_events as the canonical webhook event table name
- Prefer managed services
- Never expose Supabase service-role credentials
- Treat Stripe webhooks as the source of billing truth
- Validate external input with Zod
- Keep vendor-specific code isolated
- No Prisma, Drizzle, Redux, GraphQL, Redis, Docker, microservices, or separate backend

## Required webhook design

Document:

- Signature verification
- INSERT ... ON CONFLICT DO NOTHING event claiming
- pending, processing, processed, and failed states
- Atomic subscription upsert and event-state update at the database transaction boundary
- Rollback behaviour if processing crashes
- Stale-processing recovery using updated_at and a timeout policy
- Retry and dead-letter behaviour
- Unknown event handling
- invoice.paid handling
- Duplicate delivery handling

## Required entitlement design

Define entitlement policy in central product configuration:

- active and trialing: premium access
- past_due: no access by default
- canceled, unpaid, incomplete, and incomplete_expired: no access
- unknown status or missing subscription: deny by default

The past_due policy must be configurable in lib/config.ts, but the default must be no premium access.

## Required database and RLS design

Document:

- profiles
- subscriptions
- webhook_events
- UUID keys and foreign keys
- timestamps and updated_at triggers
- constraints and indexes
- initial migration requirements
- authenticated-user policies
- service-role boundaries

State clearly that service-role access bypasses RLS entirely. Do not create auth.uid() IS NULL policies. Privileged tables such as webhook_events must have no authenticated-user policies.

Preserve the warning that workspaces and usage-based billing may require new relationships, foreign keys, or billing-owner changes.

## Required Stripe versioning

Pin the Stripe Node SDK in package.json and record STRIPE_API_VERSION separately in configuration. Document deliberate upgrade and testing requirements for both.

## Required output

Create or update:

- docs/implementation-plan.md
- docs/schema.md
- docs/decisions.md
- README.md
- CLAUDE.md

The documentation must cover:

1. Architecture and directory structure
2. Authentication and password recovery
3. Stripe Checkout, Portal, metadata, and ownership resolution
4. Atomic webhook claim and transaction processing
5. Entitlement rules and unknown-status handling
6. Service-role boundaries and RLS
7. Optional module boundaries
8. Environment variables and pinned Stripe SDK/API-version guidance
9. Testing and deployment strategy
10. Risks, non-goals, implementation sequence, and acceptance gates

For every proposed dependency, state why it is needed, whether it is core or optional, its maintenance cost, and any simpler alternative rejected.

Before finishing, identify contradictions and unnecessary complexity, and ask no more than five decisions requiring approval.
```

## Completed record

After Stage 1 is complete, verify that the documentation includes:

- npm-only commands and `package-lock.json`
- `lib/` used consistently; no `src/lib/`
- `webhook_events` used consistently; no `stripe_events`
- Atomic webhook claiming with `INSERT ... ON CONFLICT DO NOTHING`
- Explicit `pending`, `processing`, `processed`, and `failed` states
- Subscription upsert and event status update in one transaction
- Stale-processing recovery using `updated_at`
- `invoice.paid` in the entitlement-controlling event set
- `past_due` defaulting to no access through `lib/config.ts`
- Service-role bypassing RLS without an `auth.uid() IS NULL` policy
- Password recovery request and callback flows
- `updated_at`, constraints, and unknown-status handling
- `supabase/migrations/0001_initial.sql`
- Module schema-impact warnings
- Documentation split across all required files

Commit the checkpoint:

```bash
git add docs/implementation-plan.md docs/schema.md docs/decisions.md README.md CLAUDE.md
git commit -m "stage 1: architecture plan"
```

## Note - This stage was redone by Perplexity Pro after Claude at beginning of project

Refer to `docs/stage1-version-comparison.md` for notes on what changed and why the latest iteration is better.

---

# Stage 2: Project foundation

**Claude Free stage.**

Before opening Claude Free, use Perplexity Pro to confirm the current Next.js App Router setup, shadcn/ui initialization, and npm conventions. Update `docs/decisions.md` if anything changes.

## Claude Free prompt

```text
Implement the foundation phase from docs/implementation-plan.md, docs/schema.md, and docs/decisions.md.

Before editing:

1. Read docs/implementation-plan.md, docs/schema.md, and docs/decisions.md.
2. Inspect the current repository.
3. Read any existing CLAUDE.md.
4. Confirm files and dependencies in scope.
5. Do not implement optional modules.

## Implement

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui-style base components
- ESLint and formatting
- npm scripts and package-lock.json
- Central product configuration in lib/config.ts
- Typed environment-variable validation in lib/env.ts
- Public marketing page
- Reusable application shell
- Dashboard layout
- Loading, error, empty, and unauthorized states
- .env.example
- README foundation
- Initial CLAUDE.md

Use npm exclusively. Do not use pnpm or yarn.

Use lib/ at the project root. Do not create src/lib/.

## Constraints

- Keep product names, URLs, branding, and feature flags centralized
- Do not hard-code product-specific values
- Keep the UI product-neutral
- Avoid unnecessary client components
- Do not add database, Stripe, email, analytics, or monitoring code yet

## Verification

Run formatting, lint, type checking, and a production build.

At the end, report files changed, commands run, assumptions, known limitations, and the recommended next phase.
```

## Local verification

```bash
npm run dev
npm run build
```

## Checkpoint

```bash
git add .
git commit -m "stage 2: project foundation"
```

---

# Stage 3: Supabase authentication

**Claude Free stage.**

Before opening Claude Free, use Perplexity Pro to verify the current `@supabase/ssr` approach for Next.js App Router.

## Claude Free prompt

```text
Implement the Supabase authentication and database foundation described in the approved plan.

Before editing:

1. Read CLAUDE.md.
2. Read docs/implementation-plan.md, docs/schema.md, and docs/decisions.md.
3. Inspect the existing application structure.
4. Inspect current Next.js and Supabase package versions.
5. Follow the current @supabase/ssr approach. Do not use deprecated helpers.

## Implement

- Browser Supabase client
- Server Supabase client
- Server-only administrative client
- Session refresh middleware
- Sign-up, login, sign-out, and password reset flows
- Protected dashboard route behaviour
- User profile creation
- Account settings foundation

Use lib/ for all application-library code.

## Database migration

Create the real initial migration:

supabase/migrations/0001_initial.sql

It must include:

- profiles
- subscriptions
- webhook_events
- UUID keys and foreign keys
- timestamps
- updated_at triggers
- indexes
- constraints
- enum types
- RLS enablement
- authenticated-user policies
- no authenticated-user policies on webhook_events

The webhook_events table must include updated_at for stale-processing recovery.

Do not create auth.uid() IS NULL policies. The service-role key bypasses RLS entirely.

Generate TypeScript database types into lib/database.types.ts.

## Security requirements

- Never import the service-role client into browser code
- Derive the current user from the authenticated server session only
- Enforce access with server-side authorization and RLS
- Users can read and update only their own profile
- Unauthenticated users cannot access dashboard data
- Do not log credentials or tokens

## Verification

Add tests for:

- Environment validation
- Auth input schemas
- Protected-route behaviour
- Profile authorization
- RLS-sensitive access

Run:

- Supabase migration validation
- Type generation
- Lint
- Type checking
- Unit tests
- Production build

Update README, docs/schema.md, and CLAUDE.md if new conventions are introduced.
```

## Local verification

```bash
npx supabase db reset
npx supabase gen types typescript --local > lib/database.types.ts
npm test
```

Manual checks:

- Sign up, log in, log out, and reset password
- Access `/dashboard` while logged out
- Access `/dashboard` while logged in
- Confirm a user cannot access another user's profile
- Confirm `webhook_events` is inaccessible to authenticated users
- Confirm service-role operations work server-side

## Checkpoint

```bash
git add .
git commit -m "stage 3: Supabase authentication"
```

---

# Stage 4: Stripe billing

**Claude Free stage, with Perplexity Pro used to verify webhook events and SDK version first.**

Stripe billing is high-risk. Before opening Claude Free:

- Confirm the current Stripe Node SDK version
- Confirm the pinned Stripe API version
- Confirm subscription lifecycle event names
- Verify the atomic webhook claim pattern
- Confirm `invoice.paid` handling
- Confirm the default `past_due` policy is no access

## Claude Free prompt

```text
Implement the Stripe subscription module from the approved architecture plan.

Before editing:

1. Read CLAUDE.md, docs/implementation-plan.md, docs/schema.md, and docs/decisions.md.
2. Inspect the existing Supabase clients and database types.
3. Inspect the current Stripe SDK version.
4. Confirm the existing user and profile schema.
5. Do not redesign unrelated parts of the application.

## Implement

Stripe modules:

- Stripe server client in lib/vendor/stripe/
- Product and price configuration
- Checkout session creation
- Customer Portal session creation
- Webhook parsing and handling
- Subscription-to-entitlement mapping
- Billing authorization helpers

Use the validated environment object when initializing Stripe.

Pin the Stripe Node SDK to a specific version in package.json. Record the API version in STRIPE_API_VERSION. Upgrade and test both deliberately.

Pages and routes:

- Pricing page using central plan configuration
- Checkout action
- Customer Portal action
- Billing settings page
- Current subscription display

Reusable entitlement API:

- getCurrentSubscription()
- getCurrentEntitlements()
- hasEntitlement(name)
- requireEntitlement(name)

## Database requirements

Use the canonical core tables:

- profiles
- subscriptions
- webhook_events

Do not introduce a second webhook table name.

## Webhook requirements

The webhook endpoint must:

- Verify the Stripe signature
- Reject invalid signatures
- Claim events with INSERT ... ON CONFLICT DO NOTHING or an equivalent atomic database claim
- Record pending, processing, processed, and failed states
- Use the service-role client only on the server
- Handle checkout.session.completed
- Handle customer.subscription.created
- Handle customer.subscription.updated
- Handle customer.subscription.deleted
- Handle invoice.paid
- Handle invoice.payment_failed
- Handle active, trialing, past_due, unpaid, incomplete, incomplete_expired, canceled, and unknown statuses
- Never trust client-provided plan or subscription status
- Never grant access solely because a user returns from Checkout

The subscription upsert and webhook status transition to processed must occur at the same database transaction boundary. If processing fails, the transaction must roll back.

Implement stale-processing recovery using webhook_events.updated_at and a documented timeout policy. Failed events must be safely retryable.

Unknown event types should be recorded and acknowledged without crashing.

## Entitlement requirements

Read the past_due policy from lib/config.ts.

The default must be:

pastDueGracePeriod: false

Therefore, past_due users receive no premium access unless the product owner explicitly changes the central configuration.

## Testing

Add tests for:

- Invalid signatures
- Duplicate events
- Atomic event claiming
- Transaction rollback
- Stale-processing recovery
- Subscription status mapping
- Entitlement mapping
- Checkout authorization
- Customer ownership
- Active subscription access
- Canceled subscription denial
- Past-due denial by default
- Unknown-status denial

Mock Stripe and Supabase. Do not require production credentials.

## Verification

Run lint, type checking, unit tests, and production build.

Document:

- Stripe dashboard setup
- Price ID configuration
- Stripe SDK and API-version pinning
- Stripe CLI testing
- Test card instructions
- Webhook event configuration
- Stale-processing recovery
```

## Local verification

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
npm test
```

Manual checks:

- Checkout and successful subscription
- Customer Portal
- Webhook delivery
- Duplicate webhook delivery
- Cancellation
- Payment failure
- Retry after processing failure
- Recovery of a stale processing row

## Checkpoint

```bash
git add .
git commit -m "stage 4: Stripe billing"
```

---

# Stage 5: Optional integrations

**Claude Free stage.**

Use Perplexity Pro first to check current setup documentation for any selected module, especially Resend, PostHog, Sentry, and other frequently changing SDKs.

## Important module rule

Workspaces and usage-based billing are not necessarily schema-neutral:

- Workspaces may require workspace, membership, ownership, and billing relationships.
- Usage-based billing may require usage-event tables, metering relationships, or a billing-owner field on subscriptions.

Review and document these impacts before implementation.

## Claude Free prompt

```text
Implement only the following optional modules:

[choose: Resend / PostHog / Sentry / Supabase Storage / Workspaces / Usage-based billing / Background jobs]

Before editing:

1. Read CLAUDE.md.
2. Read docs/implementation-plan.md, docs/schema.md, and docs/decisions.md.
3. Inspect current integration patterns.
4. Do not implement unselected modules.
5. Confirm whether the selected module requires schema or billing-owner changes.

For each selected module:

- Isolate vendor-specific code under lib/modules/<module>/
- Use lib/, never src/lib/
- Disable the module when its environment variables are absent
- Add typed configuration
- Add a small adapter API
- Avoid exposing secrets to browser code
- Add tests for enabled and disabled behaviour
- Document setup and removal instructions
- Add numbered migrations where schema changes are required
- Document any relationships to profiles or subscriptions
- Keep the core application functional when the module is disabled

Workspaces and usage-based billing must not silently alter core billing semantics. Review and document any required ownership or relationship changes before implementation.

Run lint, type checking, tests, and build. Update README and CLAUDE.md.
```

## Local verification

Remove optional environment variables and confirm that the app still builds and runs.

If a selected module adds database changes:

```bash
npx supabase db reset
npx supabase db push
```

## Checkpoint

```bash
git add .
git commit -m "stage 5: optional integrations"
```

---

# Stage 6: Testing and documentation

**Perplexity Pro first, then Claude Free.**

Use Perplexity Pro to audit the documentation for accuracy. Check:

- Supabase type-generation commands
- Stripe CLI commands
- Stripe event names
- Stripe SDK and API-version guidance
- Vercel deployment steps
- npm scripts
- Migration paths
- RLS wording
- Stale webhook recovery instructions

Paste corrections into the documentation before giving Claude Free the stage prompt.

## Claude Free prompt

```text
Audit and complete the testing and documentation for the reusable SaaS starter.

Do not add new product features.

## Test coverage

Add or improve tests for:

- Environment validation
- Authentication input validation
- Protected routes
- Profile authorization
- RLS-sensitive access
- Service-role isolation
- Stripe webhook signature validation
- Webhook idempotency
- Atomic webhook claiming
- Transaction rollback
- Stale-processing recovery
- Subscription status mapping
- Entitlement checks
- Past-due denial by default
- Checkout authorization
- Customer ownership
- Optional integrations being safely disabled

Add Playwright tests for:

- Public homepage
- Signup and login navigation
- Unauthenticated dashboard access
- Authenticated dashboard access
- Pricing page
- Billing page

Do not make tests depend on production Supabase or Stripe.

## Documentation

Ensure these files are accurate:

- README.md
- CLAUDE.md
- docs/implementation-plan.md
- docs/schema.md
- docs/decisions.md
- prompt-plan.md

The documentation must explain:

- Local setup
- npm installation and package-lock.json
- Environment variables
- Supabase setup
- Numbered migrations
- Initial migration at supabase/migrations/0001_initial.sql
- Type generation into lib/database.types.ts
- Stripe setup
- Stripe SDK pinning
- Stripe API-version pinning
- Stripe CLI webhooks
- Vercel deployment
- Product rebranding
- Adding a feature
- Adding a gated feature
- Adding a plan
- Disabling billing
- Removing optional modules
- Workspaces and usage-billing schema impacts
- Webhook transaction boundaries
- Stale-processing recovery
- RLS and service-role boundaries
- Running all checks

Use commands that actually exist in package.json. Use npm exclusively. Do not reference pnpm, yarn, src/lib/, or stripe_events.

## Verification

Run:

- Formatting
- Lint
- Type checking
- Unit tests
- Playwright tests where possible
- Production build

Fix documentation that references missing commands, missing files, or outdated conventions.
```

## Checkpoint

```bash
git add .
git commit -m "stage 6: testing and documentation"
```

---

# Stage 7: Security review

**Perplexity Pro for the audit brief; Claude Free applies confirmed fixes.**

Use Perplexity Pro to produce an independent security audit. Bring the findings to Claude Free as a structured fix list.

## Perplexity Pro security audit prompt

```text
Perform an independent security and correctness review of a Next.js + Supabase + Stripe SaaS starter.

Review these areas:

Authentication:
- Session handling
- Protected routes
- Cross-user data access
- Password reset flows
- Correct Supabase client usage
- Service-role client isolation

Authorization:
- Server-side checks
- User IDs derived from sessions rather than request bodies
- Server-side entitlement checks
- Client bypass paths
- Checkout price authorization
- Customer ownership resolution

Supabase:
- Service-role key isolation
- RLS enabled and restrictive
- No auth.uid() IS NULL policies
- Privileged tables with no authenticated-user policies
- Constraints and indexes
- Transaction boundaries
- Migration correctness
- Privileged operation isolation

Stripe:
- Webhook signature verification
- Atomic idempotency
- webhook_events naming consistency
- Billing state from Stripe events only
- Checkout metadata ownership
- Cancellation and payment-failure handling
- invoice.paid handling
- Client manipulation of price IDs or entitlements
- Stripe SDK and API-version compatibility

Application security:
- Input validation
- Safe redirects
- Error messages that do not leak secrets
- Logs free of tokens
- Rate-sensitive endpoints
- Secret exposure in browser bundles

Maintainability:
- npm consistency
- lib/ path consistency
- Product-neutral template
- Removable optional modules
- Clear separation of responsibilities
- Documentation consistency

Produce findings ranked critical, high, medium, low, or informational with:

- File references
- Why each issue matters
- The smallest safe fix
- Remaining risks
```

## Claude Free prompt

```text
Apply the following security fixes confirmed by independent review.

Do not rewrite the application wholesale. Make only the listed fixes.

[Paste Perplexity Pro findings here — critical and high issues only]

Preserve these project conventions:

- npm only
- lib/ only; never src/lib/
- webhook_events only; never stripe_events
- Service-role bypasses RLS; do not add auth.uid() IS NULL policies
- past_due denies access by default through lib/config.ts
- Stripe SDK and API version remain explicitly pinned
- Initial migration remains supabase/migrations/0001_initial.sql
- Workspaces and usage-billing schema impacts remain documented

After fixes, run:

- Lint
- Type checking
- Unit tests
- Playwright tests
- Production build

Review the final git diff and summarize all changes.

Create docs/security-review.md documenting findings, fixes applied, and remaining risks.
```

## Checkpoint

```bash
git add .
git commit -m "stage 7: security review"
```

---

# Stage 8: Final validation

**Claude Free stage.**

The test suite and a clean checkout are the source of truth.

## Claude Free prompt

```text
Perform a final release-readiness check for this reusable SaaS template.

Do not add features.

Verify:

1. Install dependencies from package-lock.json in a clean environment
2. Confirm npm ci succeeds
3. Copy .env.example to .env.local
4. Confirm required and optional environment variables are documented
5. Confirm lib/ is the only application-library path
6. Confirm webhook_events is the only webhook event table name
7. Confirm supabase/migrations/0001_initial.sql exists and applies
8. Run the development server
9. Run lint, type checking, unit tests, Playwright tests, and production build
10. Inspect the repository for secrets, temporary files, broken links, and product-specific leftovers
11. Confirm optional modules can remain disabled
12. Confirm Workspaces and Usage-based Billing warnings are preserved
13. Confirm README commands match package.json scripts
14. Confirm all commands use npm
15. Confirm CLAUDE.md accurately describes the project
16. Confirm webhook processing has an atomic transaction boundary
17. Confirm stale-processing recovery is documented
18. Confirm past_due denies access by default
19. Confirm service-role RLS wording is accurate
20. Confirm Stripe SDK and API version are pinned and documented

## Acceptance criteria

- Installs from a clean checkout with npm ci
- Starts with documented environment variables
- Public page loads
- Unauthenticated users cannot access protected pages
- Authentication works with local Supabase
- Initial migration applies successfully
- Stripe webhook handling is signature-verified and idempotent
- Subscription upsert and event completion update are atomic
- Stale processing rows have a documented recovery path
- Entitlements are checked server-side
- past_due is denied by default
- No secrets are committed or exposed to browser bundles
- Rebrandable through central configuration
- No product-specific business logic remains in the template
- Core application works with optional integrations disabled
- No pnpm, yarn, src/lib/, or stripe_events references remain

Fix only issues required to meet these criteria.

Report:

- Final validation results
- Commands run
- Remaining manual setup steps
- Known limitations
- Recommended tag name, such as v0.1.0-template
```

## Local verification

Run this from a clean checkout:

```bash
git stash

git clone . ../clean-test
cd ../clean-test

npm ci
cp .env.example .env.local

npm run dev
npm test
npm run build
```

Also verify migrations:

```bash
npx supabase db reset
npx supabase gen types typescript --local > lib/database.types.ts
```

Search for prohibited conventions:

```bash
grep -R "pnpm\|yarn\|src/lib\|stripe_events" . \
  --exclude-dir=node_modules \
  --exclude-dir=.git
```

The search should return no project-documentation or source-code references.

## Final commit and tag

```bash
git add .
git commit -m "stage 8: final validation"
git tag v0.1.0-template
```
