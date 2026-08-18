Use a **seven-stage workflow**, with one Claude Code session or checkpoint per stage. Keep **thinking on** for architecture, security, billing, and debugging; use **medium effort** for routine implementation and **high/xhigh** only for genuinely complex work. Effort controls the depth and frequency of reasoning, while the thinking toggle controls whether reasoning is shown; lower effort is faster and cheaper, while higher effort is intended for complex coding tasks. [code.claude](https://code.claude.com/docs/en/model-config)

Use `/effort low`, `/effort medium`, `/effort high`, or `/effort xhigh` before each stage. If your interface does not expose `xhigh`, use `high`. [code.claude](https://code.claude.com/docs/en/model-config)

# Before starting

## Step 1: Create the repository

```bash
mkdir my-saas-template
cd my-saas-template
git init
claude
```

Do not create the Next.js app yet. Let Claude inspect the empty repository and propose the structure first.

## Step 2: Set the model

Recommended default:

- **Model:** Claude Sonnet for routine implementation.
- **Model:** Claude Opus for architecture, security review, Stripe billing, and difficult debugging.
- **Thinking:** On.
- **Effort:** Medium by default; high or xhigh for architecture and security.

Claude Code’s model configuration supports changing effort through `/effort`, the model picker, a command-line flag, or project settings. [code.claude](https://code.claude.com/docs/en/model-config)

# Stage 1: Architecture

## Purpose

Create a plan without writing application code. This prevents Claude from prematurely building optional features or choosing unnecessary dependencies.

## Settings

- **Model:** Opus if available; otherwise Sonnet.
- **Thinking:** On.
- **Effort:** High.
- **Expected duration:** One session.

## Prompt

```text
You are the lead engineer designing a reusable starter repository for lean, subscription-based micro-SaaS applications.

Do not write application code yet.

First inspect the repository, available tools, and existing files. Then design the smallest maintainable modular monolith for solo-founder SaaS products.

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

The mandatory foundation should contain:

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

Treat these as optional modules:

- Workspaces and teams
- Usage-based billing
- Supabase Storage
- Resend
- PostHog
- Sentry
- AI integrations
- Background jobs

## Architectural principles

- Use a modular monolith.
- Minimize dependencies and operational overhead.
- Prefer managed services.
- Keep authentication, authorization, billing, and database access server-safe.
- Never expose Supabase service-role credentials.
- Treat Stripe webhooks as the source of truth for billing state.
- Validate external input with Zod.
- Keep vendor-specific code isolated.
- Keep product-specific business logic out of the template.
- Do not add Prisma, Drizzle, Redux, GraphQL, Redis, Docker, microservices, or a separate backend unless you identify a concrete requirement.
- Do not create speculative abstractions.

## Required planning output

Create `docs/implementation-plan.md` containing:

1. Architecture overview.
2. Proposed directory structure.
3. Core database schema.
4. Authentication flow.
5. Stripe billing flow.
6. Webhook and idempotency strategy.
7. Entitlement model.
8. Security model.
9. Optional module boundaries.
10. Environment variables.
11. Testing strategy.
12. Deployment strategy.
13. Major risks and trade-offs.
14. Explicit non-goals.
15. Phased implementation sequence.

For every proposed dependency, state:

- Why it is needed.
- Whether it belongs in the core template or an optional module.
- What maintenance cost it introduces.
- What simpler alternative was rejected, if any.

Before finishing:

- Identify contradictory requirements.
- Identify unnecessary complexity.
- Recommend the smallest viable core.
- Do not implement code.
- Ask no more than five decisions that genuinely require my approval.
```

## Checkpoint

Review `docs/implementation-plan.md`. Make sure it does not require every optional integration in the initial codebase.

Then commit:

```bash
git add .
git commit -m "Add SaaS template architecture plan"
```

# Stage 2: Project foundation

## Settings

- **Model:** Sonnet.
- **Thinking:** On.
- **Effort:** Medium.
- **Expected duration:** One session.

## Prompt

```text
Implement the foundation phase from `docs/implementation-plan.md`.

Before editing:

1. Read `docs/implementation-plan.md`.
2. Inspect the current repository.
3. Read any existing `CLAUDE.md`.
4. Confirm the files and dependencies that are in scope.
5. Do not implement optional modules unless the plan explicitly includes one.

## Implement

Set up:

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

Use the existing package manager. If no package manager exists, use pnpm.

## Constraints

- Keep all product name, URLs, branding, navigation, and feature flags centralized.
- Do not hard-code product-specific values throughout the codebase.
- Keep the UI product-neutral.
- Avoid unnecessary client components.
- Do not add database, Stripe, email, analytics, or monitoring code yet unless required by the approved plan.
- Do not upgrade unrelated dependencies.
- Do not perform unrelated refactors.

## Verification

Run:

- Formatting
- Lint
- Type checking
- Unit tests, if present
- Production build

Fix errors caused by your changes.

Review the final diff for:

- Unnecessary dependencies
- Hard-coded product values
- Client/server boundary violations
- Dead code
- Missing setup documentation

At the end, report:

- Files created or changed
- Commands run and results
- Assumptions
- Known limitations
- Recommended next phase

Stop when the foundation acceptance criteria pass.
```

## Checkpoint

Verify that the app starts:

```bash
npm run dev
```

Then commit:

```bash
git add .
git commit -m "Add reusable SaaS application foundation"
```

Replace `npm` with your configured package-manager command if needed.

# Stage 3: Supabase authentication

## Settings

- **Model:** Sonnet.
- **Thinking:** On.
- **Effort:** Medium.
- **Increase to high** if Claude encounters SSR, cookie, middleware, or RLS problems.

## Prompt

```text
Implement the Supabase authentication and database foundation described in the approved plan.

Before editing:

1. Read `CLAUDE.md`.
2. Read `docs/implementation-plan.md`.
3. Inspect the existing application structure.
4. Inspect the current Next.js and Supabase package versions.
5. Follow the current Supabase SSR approach for Next.js rather than relying on deprecated helpers.

## Implement

Create:

- Browser Supabase client
- Server Supabase client
- Server-only administrative client
- Session refresh middleware or proxy
- Sign-up flow
- Login flow
- Sign-out flow
- Password reset flow
- Protected dashboard route behavior
- Authenticated server-side user retrieval
- User profile creation
- Account settings foundation

Create database migrations for:

- profiles
- optional workspaces only if included in the approved core plan
- required membership tables only if workspaces are enabled

Add:

- UUID keys where appropriate
- Foreign keys
- Timestamps
- Useful indexes
- Updated-at handling
- Row Level Security policies
- Generated TypeScript database types
- Local seed data if useful

## Security requirements

- Never import the service-role client into browser code.
- Do not trust user IDs submitted by the client.
- Derive the current user from the authenticated server session.
- Enforce access using both server-side authorization and RLS.
- Ensure users can read and update only their own profile.
- Ensure unauthenticated users cannot access dashboard data.
- Do not log credentials, access tokens, or sensitive personal data.

## Verification

Add tests for:

- Environment validation
- Auth input schemas
- Protected-route behavior
- Profile authorization
- RLS-sensitive data access where practical

Run:

- Supabase migration validation
- Type generation
- Lint
- Type checking
- Unit tests
- Production build

Update:

- README
- `docs/database.md`
- `docs/deployment.md`
- `CLAUDE.md` if new conventions are introduced

Stop when authentication works locally or when the exact external setup limitation is documented.
```

## Checkpoint

Test manually:

- Sign up.
- Log in.
- Log out.
- Reset a password.
- Access `/dashboard` while logged out.
- Access `/dashboard` while logged in.
- Confirm a user cannot access another user’s profile.

Commit:

```bash
git add .
git commit -m "Add Supabase authentication and database foundation"
```

# Stage 4: Stripe subscriptions

## Settings

- **Model:** Opus preferred.
- **Thinking:** On.
- **Effort:** High.
- **Use xhigh** if implementing complex subscription states or debugging webhook behavior.

Stripe billing is a high-risk part of the template because incorrect webhook or entitlement logic can grant access incorrectly. Stripe’s subscription documentation covers subscription lifecycle handling, while the implementation should use verified webhooks as the server-side billing source of truth. [docs.stripe](https://docs.stripe.com/subscriptions)

## Prompt

```text
Implement the Stripe subscription module from the approved architecture plan.

Before editing:

1. Read `CLAUDE.md`, `docs/implementation-plan.md`, and `docs/database.md`.
2. Inspect the existing Supabase clients and database types.
3. Inspect the current Stripe SDK version.
4. Confirm the existing user and profile schema.
5. Do not redesign unrelated parts of the application.

## Implement

Create isolated Stripe modules for:

- Stripe server client
- Product and price configuration
- Checkout session creation
- Customer Portal session creation
- Webhook parsing and handling
- Subscription-to-entitlement mapping
- Billing authorization helpers

Create database migrations for:

- customers
- subscriptions
- plans, if required by the approved schema
- webhook_events or an equivalent idempotency table

Implement:

- Pricing page using central plan configuration
- Checkout action or route
- Customer Portal action or route
- Billing settings page
- Current subscription display
- Subscription status synchronization
- Server-side entitlement checks

Use a reusable API such as:

- `getCurrentSubscription()`
- `getCurrentEntitlements()`
- `hasEntitlement(name)`
- `requireEntitlement(name)`

## Webhook requirements

The webhook endpoint must:

- Verify the Stripe signature.
- Reject invalid signatures.
- Be idempotent.
- Record processed event IDs.
- Avoid duplicate database updates.
- Use the Supabase service-role client only on the server.
- Never trust client-provided plan or subscription status.
- Handle at least:
  - checkout.session.completed
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.paid
  - invoice.payment_failed
- Handle cancellation at period end.
- Handle active, trialing, past_due, unpaid, incomplete, canceled, and paused states deliberately.
- Avoid granting access solely because a user returns from Checkout.

## Testing

Add tests for:

- Invalid webhook signatures
- Duplicate webhook events
- Subscription status mapping
- Entitlement mapping
- Checkout authorization
- Customer ownership
- Access behavior for active, canceled, and past-due subscriptions

Mock Stripe and Supabase in unit tests. Do not require production credentials.

## Verification

Run:

- Lint
- Type checking
- Unit tests
- Production build

Document:

- Required Stripe dashboard setup
- Price ID configuration
- Stripe CLI local webhook testing
- Test card instructions
- Webhook event configuration
- How to disable billing for a free product

Review the final diff for:

- Secret exposure
- Client-side billing trust
- Missing webhook idempotency
- Incorrect user/customer association
- Entitlements granted from unverified client data

Stop when the billing acceptance criteria pass.
```

## Checkpoint

Use Stripe CLI locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Then test:

- Checkout.
- Successful subscription.
- Customer Portal.
- Webhook delivery.
- Duplicate webhook delivery.
- Cancellation.
- Payment failure behavior.

Commit:

```bash
git add .
git commit -m "Add Stripe subscriptions and entitlement system"
```

# Stage 5: Optional integrations

Do not implement every integration automatically. Choose only the ones you need for your starter.

## Settings

- **Model:** Sonnet.
- **Thinking:** On.
- **Effort:** Low or medium.
- **Use high** for background jobs or complex file-processing workflows.

## Prompt

```text
Implement only the following optional modules:

- [choose: Resend]
- [choose: PostHog]
- [choose: Sentry]
- [choose: Supabase Storage]
- [choose: Workspaces]
- [choose: Usage-based billing]
- [choose: Background jobs]

Before editing:

1. Read `CLAUDE.md`.
2. Read the implementation plan.
3. Inspect current integration patterns.
4. Confirm that each selected module is not already implemented.
5. Do not implement unselected modules.

For each selected module:

- Isolate vendor-specific code in `src/lib/<module>`.
- Make it disabled when its environment variables are absent.
- Add typed configuration.
- Add a small adapter API.
- Avoid exposing secrets to browser code.
- Add tests for enabled and disabled behavior.
- Document setup and removal instructions.
- Keep the core application functional when the module is disabled.

Do not add abstractions beyond what is needed to isolate the integration.

Run lint, type checking, tests, and build. Update README, relevant documentation, and CLAUDE.md. Stop after the selected modules are complete.
```

## Checkpoint

Make sure the app still works with optional environment variables removed. This is important: a reusable template should not fail merely because one project does not use email, analytics, or monitoring.

Commit:

```bash
git add .
git commit -m "Add selected optional SaaS integrations"
```

# Stage 6: Testing and documentation

## Settings

- **Model:** Sonnet.
- **Thinking:** On.
- **Effort:** Medium.
- **Use high** if tests reveal security or data-integrity failures.

## Prompt

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
- Optional integrations being disabled safely

Add Playwright tests for:

- Public homepage
- Signup navigation
- Login navigation
- Unauthenticated dashboard access
- Authenticated dashboard access
- Pricing page
- Billing page

Do not make tests depend on production Supabase or Stripe.

## Documentation

Ensure the following are accurate:

- README.md
- CLAUDE.md
- docs/architecture.md
- docs/database.md
- docs/billing.md
- docs/customization.md
- docs/deployment.md

The documentation must explain:

- Local setup
- Environment variables
- Supabase setup
- Migrations
- Type generation
- Stripe setup
- Stripe CLI webhooks
- Vercel deployment
- Product rebranding
- Adding a new database-backed feature
- Adding a new gated feature
- Adding a Stripe plan
- Disabling billing
- Removing optional modules
- Running all checks

Use commands that actually exist in `package.json`.

## Verification

Run:

- Formatting
- Lint
- Type checking
- Unit tests
- End-to-end tests where possible
- Production build

Fix documentation that references missing commands or files.

Do not perform unrelated code refactors.
```

# Stage 7: Security and maintainability review

## Settings

- **Model:** Opus.
- **Thinking:** On.
- **Effort:** xhigh or high.
- **Do not use low effort** for this stage.

## Prompt

```text
Perform a security, correctness, and maintainability audit of this reusable micro-SaaS starter.

Do not rewrite the application wholesale. Inspect the code first and make only justified fixes.

## Review areas

### Authentication

- Are sessions handled correctly?
- Are protected routes actually protected?
- Can a user access another user’s data?
- Are password and reset flows safe?
- Are server and browser Supabase clients used correctly?

### Authorization

- Are authorization checks performed server-side?
- Are user IDs derived from the authenticated session?
- Are workspace permissions enforced if workspaces exist?
- Are entitlements checked on the server?
- Can a user bypass a feature gate through a client request?

### Supabase

- Is the service-role key server-only?
- Are RLS policies enabled?
- Are policies restrictive and correctly scoped?
- Are database constraints and indexes adequate?
- Are privileged operations isolated?

### Stripe

- Is webhook signature verification correct?
- Is webhook processing idempotent?
- Is subscription state sourced from Stripe events?
- Can checkout metadata associate a subscription with the wrong user?
- Are cancellation and payment-failure states handled correctly?
- Can a client manipulate a price ID, user ID, plan, or entitlement?

### Application security

- Are inputs validated?
- Are redirects safe?
- Are error messages leaking secrets or internal details?
- Are logs free of tokens and credentials?
- Are rate-sensitive endpoints identified?
- Are dependencies reasonable and current enough for the project?

### Maintainability

- Is the template product-neutral?
- Are optional modules easy to remove?
- Are responsibilities clearly separated?
- Are there unnecessary dependencies?
- Is the directory structure understandable?
- Are setup instructions reproducible?

## Required output

Create `docs/security-review.md` containing:

- Findings ranked critical, high, medium, low, or informational.
- File and line references.
- Why each issue matters.
- The smallest safe fix.
- Remaining risks.

Fix critical and high-severity issues immediately. Fix medium issues if they do not require architectural redesign. Do not fix informational issues unless they are trivial.

After fixes, run:

- Lint
- Type checking
- Unit tests
- End-to-end tests
- Production build

Review the final git diff and summarize all changes.
```

# Stage 8: Final template validation

## Settings

- **Model:** Sonnet.
- **Thinking:** On.
- **Effort:** Medium.
- **Use high** if the build or deployment process fails unexpectedly.

## Prompt

```text
Perform a final release-readiness check for this reusable SaaS template.

Do not add features.

Verify that a new project can be created from this repository with minimal manual editing.

## Check

1. Clone or simulate cloning the repository into a clean directory.
2. Install dependencies from the lockfile.
3. Copy `.env.example` to `.env.local`.
4. Verify that required and optional environment variables are clearly documented.
5. Run the development server.
6. Run lint.
7. Run type checking.
8. Run unit tests.
9. Run end-to-end tests where possible.
10. Run the production build.
11. Inspect the repository for secrets, temporary files, broken links, and product-specific leftovers.
12. Verify that optional modules can remain disabled.
13. Verify that README commands match the actual scripts.
14. Verify that `CLAUDE.md` accurately describes the project.

## Acceptance criteria

- The repository installs from a clean checkout.
- The application starts with documented environment variables.
- The public page loads.
- Unauthenticated users cannot access protected pages.
- Authentication works with local Supabase.
- Stripe webhook handling is signature-verified and idempotent.
- Entitlements are checked server-side.
- No secrets are committed or exposed to browser bundles.
- The template can be rebranded through central configuration.
- The template has no unnecessary product-specific business logic.
- The core application works with optional integrations disabled.

Fix only issues required to meet these criteria.

At the end, provide:

- Final validation results.
- Remaining manual setup steps.
- Known limitations.
- A recommended tag name such as `v0.1.0-template`.
```

# Recommended settings by stage

| Stage                 | Model          | Thinking |      Effort |
| --------------------- | -------------- | -------: | ----------: |
| Architecture plan     | Opus           |       On |        High |
| Foundation            | Sonnet         |       On |      Medium |
| Supabase auth/RLS     | Sonnet or Opus |       On | Medium–High |
| Stripe billing        | Opus           |       On |        High |
| Optional integrations | Sonnet         |       On |  Low–Medium |
| Testing/docs          | Sonnet         |       On |      Medium |
| Security review       | Opus           |       On |  High–xhigh |
| Final validation      | Sonnet         |       On |      Medium |

The thinking toggle is mainly about whether reasoning is displayed; effort is the more important control for how much work Claude performs. High is a strong default for difficult coding tasks, while xhigh is better reserved for long-running or unusually complex work. [platform.claude](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost)

# Recommended Git checkpoints

Create a commit after each stage:

```bash
git add .
git commit -m "stage 1: architecture plan"
git commit -m "stage 2: project foundation"
git commit -m "stage 3: Supabase authentication"
git commit -m "stage 4: Stripe billing"
git commit -m "stage 5: optional integrations"
git commit -m "stage 6: testing and documentation"
git commit -m "stage 7: security review"
git commit -m "stage 8: final validation"
```

A safer approach is to commit only after reviewing the diff:

```bash
git diff --stat
git diff
npm run validate
git add .
git commit -m "Describe the completed stage"
```

The crucial improvement is to make every stage have **one purpose, explicit exclusions, acceptance criteria, and verification commands**. That prevents Claude from building an impressive but unnecessarily expensive boilerplate.
