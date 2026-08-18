# Prompt Plan — Perplexity Pro + Claude Free + Local Tools

Use an **eight-stage workflow**. Each stage has a defined tool assignment:

- **Perplexity Pro** — research, architecture, decisions, vendor guidance, independent review
- **Claude Free** — bounded, single-purpose implementation tasks and code generation
- **Local tools** — Git, VS Code, Supabase CLI, Stripe CLI, Vitest, Playwright, the test suite

Claude Free works best with a single focused task per session. Keep each prompt scoped to one stage. Never ask Claude Free to research, decide architecture, or review external APIs — use Perplexity Pro for that.

---

## Documentation layout

The architecture stage produces a split documentation set:

- `docs/implementation-plan.md` — concise execution checklist
- `docs/schema.md` — database contract
- `docs/decisions.md` — approved architectural choices
- `README.md` — setup, operations, migration, deployment, rationale
- `CLAUDE.md` — implementation conventions and non-negotiable security rules

Later stages must read the relevant split documents and update all affected files when implementation changes a decision or contract.

---

## Tool assignment by stage

| Stage                 | Perplexity Pro                       | Claude Free                         | Local tools                          |
| --------------------- | ------------------------------------ | ----------------------------------- | ------------------------------------ |
| Architecture plan     | Draft architecture, research vendors | —                                   | Review docs in VS Code               |
| Foundation            | Verify current Next.js/pnpm guidance | Scaffold app, config, shell, layout | `pnpm dev`, lint, build              |
| Supabase auth/RLS     | Check SSR approach, current SDK docs | Implement auth, migrations, RLS     | `supabase db reset`, type-gen, tests |
| Stripe billing        | Verify webhook events, SDK version   | Implement billing, webhooks, gates  | `stripe listen`, Vitest              |
| Optional integrations | Research module setup if needed      | Implement selected modules only     | Env toggle test, build               |
| Testing/docs          | Review docs accuracy, fill gaps      | Add missing tests, fix docs         | Vitest, Playwright, build            |
| Security review       | Independent security audit           | Fix confirmed critical/high issues  | Full test suite, `git diff`          |
| Final validation      | —                                    | Final release-readiness sweep       | Clean checkout, all checks           |

---

## Per-stage workflow

For every stage, follow this loop:

1. **Perplexity Pro** — research current requirements, vendor docs, and any breaking changes. Update `docs/` if a decision changes.
2. **Claude Free** — give it only the current stage prompt plus relevant docs. Ask it to inspect the repository before editing. Request one coherent batch of changes.
3. **Local tools** — run tests. If failures occur, return the test output and the relevant files to Claude Free. Do not ask Claude Free to research the failure cause — bring the Stripe or Supabase error back to Perplexity Pro first.
4. **Perplexity Pro (if needed)** — use as independent reviewer when the issue touches Stripe, Supabase, RLS, security, or a current external API.
5. **Git** — commit only after reviewing `git diff`.

---

## Claude Free: how to keep sessions bounded

Claude Free has a context limit. Stay within it by:

- Pasting only the relevant section of `docs/implementation-plan.md`, not the whole file
- Giving the schema excerpt, not all of `docs/schema.md`
- Asking for one stage at a time — never combine stages
- Pasting failing test output verbatim rather than describing it
- Starting a new session for each stage

If Claude Free hits its limit mid-stage, split the remaining work into a second prompt and start fresh. Never try to recover a broken context — it wastes time.

---

## When to escalate to Perplexity Pro mid-stage

Use Perplexity Pro before returning to Claude Free when:

- A Supabase SSR, cookie, or middleware error appears
- A Stripe webhook event name or field is uncertain
- RLS policies behave unexpectedly
- A test failure involves an external API contract
- A security question arises that Claude Free cannot reliably answer from code alone

Perplexity Pro is your source of truth for current external APIs. Claude Free is your source of truth for the code you already have.

---

## When Claude Pro becomes worth it

Consider upgrading Claude Free to Claude Pro when at least one of these becomes true:

- Claude Free repeatedly hits limits in a single implementation stage
- You spend more time reconstructing context than writing code
- You need long multi-file debugging sessions
- You want Claude Code to inspect, edit, test, and iterate in one workflow
- You are actively shipping multiple SaaS products every week

> Complete Stage 2 with the current combination first. If free-tier limits materially slow you down during Stage 3 or Stage 4, buy Claude Pro for one month and reassess — do not treat it as a permanent expense.

---

## Recommended Git checkpoints

```bash
git add docs/implementation-plan.md docs/schema.md docs/decisions.md README.md CLAUDE.md
git commit -m "stage 1: architecture plan"

git add .
git commit -m "stage 2: project foundation"
git commit -m "stage 3: Supabase authentication"
git commit -m "stage 4: Stripe billing"
git commit -m "stage 5: optional integrations"
git commit -m "stage 6: testing and documentation"
git commit -m "stage 7: security review"
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

Do not create the Next.js app yet. Let Claude Free inspect the empty repository and propose the structure after Stage 1 docs are written by Perplexity Pro.

### Step 2: Run Perplexity Pro first (Stage 1)

Use Perplexity Pro to draft the architecture documentation. Paste the Stage 1 prompt directly into Perplexity Pro. Save the output to `docs/`. Do not open a Claude Free session until `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md` exist and are reviewed.

---

## Stage 1: Architecture

**Perplexity Pro stage — do not use Claude Free here.**

### Purpose

Produce architecture documentation without writing application code.

### Perplexity Pro prompt

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

Optional modules (do not include by default):
- Workspaces and teams
- Usage-based billing
- Supabase Storage
- Resend
- PostHog
- Sentry
- AI integrations
- Background jobs

## Architectural principles

- Modular monolith
- Minimize dependencies
- Prefer managed services
- Never expose Supabase service-role credentials
- Treat Stripe webhooks as the source of billing truth
- Validate external input with Zod
- Keep vendor-specific code isolated
- No Prisma, Drizzle, Redux, GraphQL, Redis, Docker, microservices, or separate backend

## Required output

Create or update these files:

- `docs/implementation-plan.md` — concise build order and acceptance gates
- `docs/schema.md` — authoritative database schema, RLS expectations, constraints, indexes, timestamps
- `docs/decisions.md` — architectural decisions and trade-offs

Put setup, migration commands, deployment guidance in `README.md`.
Put implementation rules, security constraints, and scope boundaries in `CLAUDE.md`.

The documentation must cover:

1. Architecture and directory structure
2. Authentication and password recovery
3. Stripe Checkout, Portal, metadata, ownership resolution
4. Atomic webhook claim, processing/processed/failed states, retries, unknown events, invoice.paid
5. Entitlement rules and unknown-status handling
6. Service-role boundaries and RLS
7. Optional module boundaries
8. Environment variables and pinned Stripe SDK/API-version guidance
9. Testing and deployment strategy
10. Risks, non-goals, implementation sequence, and acceptance gates

For every proposed dependency state why it is needed, whether it belongs in core or optional, its maintenance cost, and any simpler alternative rejected.

Before finishing: identify contradictions, unnecessary complexity, and ask no more than five decisions that require my approval.
```

### Completed record

After Stage 1 is done, review and correct before any application code is written:

- Atomic webhook claim using `INSERT ... ON CONFLICT DO NOTHING`
- Explicit `processing`, `processed`, `failed` states with safe retry semantics
- `invoice.paid` in the entitlement-controlling event set
- Service-role used only in the webhook route and a server-only billing repository
- Password-recovery request and callback flows
- `updated_at`, constraints, and unknown-status handling on mutable records
- Documentation split into `docs/implementation-plan.md`, `docs/schema.md`, `docs/decisions.md`, `README.md`, `CLAUDE.md`

Commit the checkpoint:

```bash
git add docs/implementation-plan.md docs/schema.md docs/decisions.md README.md CLAUDE.md
git commit -m "stage 1: architecture plan"
```

---

## Stage 2: Project foundation

**Claude Free stage.**

Before opening Claude Free, use Perplexity Pro to confirm the current Next.js App Router setup approach, shadcn/ui initialization, and pnpm conventions. Update `docs/decisions.md` if anything has changed.

### Claude Free prompt

```text
Implement the foundation phase from `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md`.

Before editing:

1. Read `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md`.
2. Inspect the current repository.
3. Read any existing `CLAUDE.md`.
4. Confirm the files and dependencies that are in scope.
5. Do not implement optional modules.

## Implement

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui-style base components
- ESLint and formatting
- Central product configuration
- Typed environment-variable validation
- Public marketing page
- Reusable application shell
- Dashboard layout
- Loading, error, empty, and unauthorized states
- `.env.example`
- README foundation
- Initial `CLAUDE.md`

Use pnpm unless a package manager is already configured.

## Constraints

- Keep all product names, URLs, branding, and feature flags centralized
- Do not hard-code product-specific values
- Keep the UI product-neutral
- Avoid unnecessary client components
- Do not add database, Stripe, email, analytics, or monitoring code yet

## Verification

Run formatting, lint, type checking, and a production build. Fix errors caused by your changes.

At the end, report: files created or changed, commands run, assumptions, known limitations, and recommended next phase.

Stop when the foundation acceptance criteria pass.
```

### Local verification

```bash
pnpm dev
pnpm build
```

### Checkpoint

```bash
git add .
git commit -m "stage 2: project foundation"
```

---

## Stage 3: Supabase authentication

**Claude Free stage.**

Before opening Claude Free, use Perplexity Pro to verify the current `@supabase/ssr` approach for Next.js App Router — the SSR helpers changed and Claude Free may have outdated training data on this.

### Claude Free prompt

```text
Implement the Supabase authentication and database foundation described in the approved plan.

Before editing:

1. Read `CLAUDE.md`.
2. Read `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md`.
3. Inspect the existing application structure.
4. Inspect the current Next.js and Supabase package versions.
5. Follow the current `@supabase/ssr` approach for Next.js — do not use deprecated helpers.

## Implement

- Browser Supabase client
- Server Supabase client
- Server-only administrative client
- Session refresh middleware
- Sign-up, login, sign-out, and password reset flows
- Protected dashboard route behavior
- User profile creation
- Account settings foundation

Database migrations:
- profiles with UUID keys, foreign keys, timestamps, indexes, updated-at handling, RLS policies

Generate TypeScript database types.

## Security requirements

- Never import the service-role client into browser code
- Derive the current user from the authenticated server session only
- Enforce access with server-side authorization and RLS
- Users can read and update only their own profile
- Unauthenticated users cannot access dashboard data
- Do not log credentials or tokens

## Verification

Add tests for: environment validation, auth input schemas, protected-route behavior, profile authorization.

Run: Supabase migration validation, type generation, lint, type checking, unit tests, production build.

Update README, `docs/schema.md`, and `CLAUDE.md` if new conventions are introduced.

Stop when authentication works locally or when the exact external setup limitation is documented.
```

### Local verification

```bash
supabase db reset
supabase gen types typescript --local > src/lib/database.types.ts
pnpm test
```

Manual checks:

- Sign up, log in, log out, reset password
- Access `/dashboard` while logged out
- Access `/dashboard` while logged in
- Confirm a user cannot access another user's profile

### Checkpoint

```bash
git add .
git commit -m "stage 3: Supabase authentication"
```

---

## Stage 4: Stripe billing

**Claude Free stage, with Perplexity Pro used to verify webhook events and SDK version first.**

Stripe billing is high-risk. Before opening Claude Free:

- Use Perplexity Pro to confirm the current Stripe Node SDK version, API version, and the full set of subscription lifecycle events
- Verify the atomic webhook claim pattern
- Confirm the `invoice.paid` entitlement requirement

### Claude Free prompt

```text
Implement the Stripe subscription module from the approved architecture plan.

Before editing:

1. Read `CLAUDE.md`, `docs/implementation-plan.md`, and `docs/schema.md`.
2. Inspect the existing Supabase clients and database types.
3. Inspect the current Stripe SDK version.
4. Confirm the existing user and profile schema.
5. Do not redesign unrelated parts of the application.

## Implement

Stripe modules:
- Stripe server client
- Product and price configuration
- Checkout session creation
- Customer Portal session creation
- Webhook parsing and handling
- Subscription-to-entitlement mapping
- Billing authorization helpers

Database migrations:
- customers, subscriptions, webhook_events

Pages and routes:
- Pricing page using central plan configuration
- Checkout action
- Customer Portal action
- Billing settings page
- Current subscription display

Reusable entitlement API:
- `getCurrentSubscription()`
- `getCurrentEntitlements()`
- `hasEntitlement(name)`
- `requireEntitlement(name)`

## Webhook requirements

The webhook endpoint must:
- Verify the Stripe signature
- Reject invalid signatures
- Be idempotent using `INSERT ... ON CONFLICT DO NOTHING`
- Record processing/processed/failed states
- Use the service-role client only on the server
- Handle: checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed
- Handle: active, trialing, past_due, unpaid, incomplete, canceled, paused
- Never trust client-provided plan or subscription status
- Never grant access solely because a user returns from Checkout

## Testing

Unit tests for: invalid signatures, duplicate events, subscription status mapping, entitlement mapping, checkout authorization, customer ownership, access behavior for active/canceled/past-due subscriptions.

Mock Stripe and Supabase — do not require production credentials.

## Verification

Run lint, type checking, unit tests, and production build.

Document: Stripe dashboard setup, price ID configuration, Stripe CLI testing, test card instructions, webhook event configuration.

Stop when the billing acceptance criteria pass.
```

### Local verification

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
pnpm test
```

Manual checks:

- Checkout, successful subscription, Customer Portal
- Webhook delivery and duplicate delivery
- Cancellation and payment failure

### Checkpoint

```bash
git add .
git commit -m "stage 4: Stripe billing"
```

---

## Stage 5: Optional integrations

**Claude Free stage.** Use Perplexity Pro first to check current setup docs for any module you are adding (especially Resend, PostHog, or Sentry, which change their SDK APIs frequently).

### Claude Free prompt

```text
Implement only the following optional modules: [choose: Resend / PostHog / Sentry / Supabase Storage / Workspaces / Usage-based billing / Background jobs]

Before editing:

1. Read `CLAUDE.md`.
2. Read `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md`.
3. Inspect current integration patterns.
4. Do not implement unselected modules.

For each selected module:
- Isolate vendor-specific code in `src/lib/<module>`
- Disable when its environment variables are absent
- Add typed configuration
- Add a small adapter API
- Avoid exposing secrets to browser code
- Add tests for enabled and disabled behavior
- Document setup and removal instructions
- Keep the core application functional when the module is disabled

Run lint, type checking, tests, and build. Update README and CLAUDE.md.
```

### Local verification

Remove optional env vars and confirm the app still builds and runs.

### Checkpoint

```bash
git add .
git commit -m "stage 5: optional integrations"
```

---

## Stage 6: Testing and documentation

**Perplexity Pro first, then Claude Free.**

Use Perplexity Pro to audit the documentation for accuracy — check that Supabase type-gen commands, Stripe CLI commands, and Vercel deployment steps are current. Paste corrections into `docs/` before giving Claude Free the stage prompt.

### Claude Free prompt

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
- Stripe webhook signature validation
- Webhook idempotency
- Subscription status mapping
- Entitlement checks
- Checkout authorization
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

Ensure the following are accurate:
- README.md
- CLAUDE.md
- docs/implementation-plan.md
- docs/schema.md
- docs/decisions.md

The documentation must explain: local setup, environment variables, Supabase setup, migrations, type generation, Stripe setup, Stripe CLI webhooks, Vercel deployment, product rebranding, adding a feature, adding a gated feature, adding a plan, disabling billing, removing optional modules, running all checks.

Use commands that actually exist in `package.json`.

## Verification

Run: formatting, lint, type checking, unit tests, Playwright tests where possible, production build. Fix documentation that references missing commands or files.
```

### Checkpoint

```bash
git add .
git commit -m "stage 6: testing and documentation"
```

---

## Stage 7: Security review

**Perplexity Pro for the audit brief, Claude Free to apply confirmed fixes.**

Use Perplexity Pro to produce the security audit independently — it can research current OWASP guidance, Supabase RLS edge cases, and Stripe webhook security without relying on its training data. Bring the Perplexity Pro findings to Claude Free as a structured fix list.

### Perplexity Pro security audit prompt

```text
Perform an independent security and correctness review of a Next.js + Supabase + Stripe SaaS starter.

Review these areas:

Authentication: session handling, protected routes, cross-user data access, password reset flows, correct Supabase client usage.

Authorization: server-side checks, user IDs from session not client, entitlement checks on server, client bypass paths.

Supabase: service-role key isolation, RLS enabled and restrictive, constraints and indexes, privileged operation isolation.

Stripe: webhook signature verification, idempotency, billing state from Stripe events only, checkout metadata ownership, cancellation and payment-failure handling, client manipulation of price IDs or entitlements.

Application security: input validation, safe redirects, error messages not leaking secrets, logs free of tokens, rate-sensitive endpoints.

Maintainability: product-neutral template, removable optional modules, clear separation of responsibilities.

Produce findings ranked critical, high, medium, low, or informational with file references, why each issue matters, the smallest safe fix, and remaining risks.
```

### Claude Free prompt (after Perplexity Pro review)

```text
Apply the following security fixes confirmed by independent review. Do not rewrite the application wholesale. Make only the listed fixes.

[Paste Perplexity Pro findings here — critical and high issues only]

After fixes run lint, type checking, unit tests, Playwright tests, and production build. Review the final git diff and summarize all changes.

Create `docs/security-review.md` documenting findings, fixes applied, and remaining risks.
```

### Checkpoint

```bash
git add .
git commit -m "stage 7: security review"
```

---

## Stage 8: Final validation

**Claude Free stage.** The test suite is the source of truth here — local tools confirm the result.

### Claude Free prompt

```text
Perform a final release-readiness check for this reusable SaaS template.

Do not add features.

Verify:
1. Install dependencies from the lockfile in a clean environment
2. Copy `.env.example` to `.env.local`
3. Confirm required and optional environment variables are documented
4. Run the development server
5. Run lint, type checking, unit tests, Playwright tests, and production build
6. Inspect the repository for secrets, temporary files, broken links, product-specific leftovers
7. Confirm optional modules can remain disabled
8. Confirm README commands match actual scripts
9. Confirm `CLAUDE.md` accurately describes the project

## Acceptance criteria

- Installs from a clean checkout
- Starts with documented environment variables
- Public page loads
- Unauthenticated users cannot access protected pages
- Authentication works with local Supabase
- Stripe webhook handling is signature-verified and idempotent
- Entitlements checked server-side
- No secrets committed or exposed to browser bundles
- Rebrandable through central configuration
- No product-specific business logic in the template
- Core application works with optional integrations disabled

Fix only issues required to meet these criteria.

Report: final validation results, remaining manual setup steps, known limitations, and a recommended tag name such as `v0.1.0-template`.
```

### Local verification

```bash
git stash
git clone . ../clean-test && cd ../clean-test
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
pnpm test
pnpm build
```

### Final commit and tag

```bash
git add .
git commit -m "stage 8: final validation"
git tag v0.1.0-template
```
