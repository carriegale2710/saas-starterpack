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

## Package Manager

This project uses **npm** exclusively. npm comes pre-installed with Node.js and requires no additional setup. All commands in this document use `npm`. Do not switch to pnpm or yarn — it would introduce a lockfile mismatch.

---

## Tool assignment by stage

| Stage                 | Perplexity Pro                       | Claude Free                         | Local tools                          |
| --------------------- | ------------------------------------ | ----------------------------------- | ------------------------------------ |
| Architecture plan     | Draft architecture, research vendors | —                                   | Review docs in VS Code               |
| Foundation            | Verify current Next.js/npm guidance  | Scaffold app, config, shell, layout | `npm run dev`, lint, build           |
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

- Paste only the relevant section of `docs/implementation-plan.md`, not the whole file
- Give the schema excerpt, not all of `docs/schema.md`
- Ask for one stage at a time — never combine stages
- Paste failing test output verbatim rather than describing it
- Start a new session for each stage

If Claude Free hits its limit mid-stage, split the remaining work into a second prompt and start fresh.

---

## When to escalate to Perplexity Pro mid-stage

Use Perplexity Pro before returning to Claude Free when:

- A Supabase SSR, cookie, or middleware error appears
- A Stripe webhook event name or field is uncertain
- RLS policies behave unexpectedly
- A test failure involves an external API contract
- A security question arises that Claude Free cannot reliably answer from code alone

---

## When Claude Pro becomes worth it

- Claude Free repeatedly hits limits in a single implementation stage
- You spend more time reconstructing context than writing code
- You need long multi-file debugging sessions
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

### Step 2: Run Perplexity Pro first (Stage 1)

Use Perplexity Pro to draft the architecture documentation. Save the output to `docs/`. Do not open a Claude Free session until `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md` exist and are reviewed.

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

### Note - This stage was redone by Perplexity Pro after Claude at beginning of project

Refer to `docs/stage1-version-comparison.md` for notes on what changed and why the latest iteration is better.

### Completed record

After Stage 1 is done, review and correct before any application code is written:

- Atomic webhook claim using `UPDATE ... WHERE status = 'pending' RETURNING id`
- Subscription upsert and status update wrapped in a single database transaction
- Stale-processing recovery query documented in README
- Explicit `processing`, `processed`, `failed` states with safe retry semantics
- `invoice.paid` in the entitlement-controlling event set
- `past_due` policy defined in `lib/config.ts` (default: deny)
- Service-role described as bypassing RLS — no `auth.uid() IS NULL` policies
- `webhook_events` used consistently — never `stripe_events`
- `lib/` used consistently — never `src/lib/`
- Stripe SDK version pinned in `package.json` alongside `STRIPE_API_VERSION`
- `supabase/migrations/0001_initial.sql` listed as a Stage 3 deliverable
- Module schema-impact warnings for `workspaces` and `usage-billing`
- Documentation split into `docs/implementation-plan.md`, `docs/schema.md`, `docs/decisions.md`, `README.md`, `CLAUDE.md`

Commit the checkpoint:

```bash
git add docs/implementation-plan.md docs/schema.md docs/decisions.md README.md CLAUDE.md
git commit -m "stage 1: architecture plan"
```

---

## Stage 2: Project foundation

**Claude Free stage.**

Before opening Claude Free, use Perplexity Pro to confirm the current Next.js App Router setup approach and npm conventions.

### Claude Free prompt

```text
Implement the foundation phase from `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md`.

Before editing:
1. Read `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md`.
2. Inspect the current repository.
3. Read any existing `CLAUDE.md`.
4. Confirm the files and dependencies in scope.
5. Do not implement optional modules.

## Implement

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui-style base components
- ESLint and formatting
- Central product configuration (`lib/config.ts` including `BILLING_CONFIG.pastDueGracePeriod`)
- Typed environment-variable validation (`lib/env.ts`)
- Public marketing page
- Reusable application shell
- Dashboard layout
- Loading, error, empty, and unauthorized states
- `.env.example`
- README foundation
- Initial `CLAUDE.md`

Use npm. Do not use pnpm or yarn.

## Constraints

- Use `lib/` at the project root — never `src/lib/`
- Keep all product names, URLs, branding, and feature flags centralized in `lib/config.ts`
- Do not hard-code product-specific values
- Keep the UI product-neutral
- Avoid unnecessary client components
- Do not add database, Stripe, email, analytics, or monitoring code yet

## Verification

Run formatting, lint, type checking, and a production build. Fix errors caused by your changes.

Report: files created or changed, commands run, assumptions, known limitations, and recommended next phase.
```

### Local verification

```bash
npm run dev
npm run build
```

### Checkpoint

```bash
git add .
git commit -m "stage 2: project foundation"
```

---

## Stage 3: Supabase authentication

**Claude Free stage.**

Before opening Claude Free, use Perplexity Pro to verify the current `@supabase/ssr` approach for Next.js App Router.

### Claude Free prompt

```text
Implement the Supabase authentication and database foundation described in the approved plan.

Before editing:
1. Read `CLAUDE.md`.
2. Read `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md`.
3. Inspect the existing application structure.
4. Inspect the current Next.js and Supabase package versions.
5. Follow the current `@supabase/ssr` approach — do not use deprecated helpers.

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
- **Generate `supabase/migrations/0001_initial.sql`** containing all DDL from `docs/schema.md`: profiles, subscriptions, webhook_events tables; all types, triggers, indexes, constraints, and RLS policies
- webhook_events must include `updated_at` (required for stale-processing recovery)
- Do NOT add an `auth.uid() IS NULL` policy to webhook_events — the table has no authenticated-user policies; service-role bypasses RLS unconditionally

Generate TypeScript database types.

## Security requirements

- Never import the service-role client into browser code
- Derive the current user from the authenticated server session only
- Enforce access with server-side authorization and RLS
- Users can read and update only their own profile
- Unauthenticated users cannot access dashboard data
- Do not log credentials or tokens

## Verification

Run: Supabase migration validation, type generation, lint, type checking, unit tests, production build.

Update README, `docs/schema.md`, and `CLAUDE.md` if new conventions are introduced.
```

### Local verification

```bash
npx supabase db reset
npx supabase gen types typescript --local > lib/database.types.ts
npm test
```

Manual checks:

- Sign up, log in, log out, reset password
- Access `/dashboard` while logged out → redirect to login
- Access `/dashboard` while logged in → dashboard renders
- Confirm a user cannot access another user's profile

### Checkpoint

```bash
git add .
git commit -m "stage 3: Supabase authentication"
```

---

## Stage 4: Stripe billing

**Claude Free stage.**

Before opening Claude Free, use Perplexity Pro to verify current webhook event names, the current stable Stripe Node SDK major version, and confirm the pinned API version string.

### Claude Free prompt

```text
Implement Stripe billing as described in the approved plan.

Before editing:
1. Read `CLAUDE.md`.
2. Read `docs/implementation-plan.md`, `docs/schema.md`, and `docs/decisions.md`.
3. Inspect existing application structure and current package versions.

## Implement

- Stripe SDK initialized from `lib/vendor/stripe/client.ts` using the validated `env` object
- Pin stripe SDK version in package.json (confirm correct major version with Perplexity before proceeding)
- `/api/stripe/checkout` — Checkout Session creation with user_id metadata
- `/api/stripe/portal` — Portal Session creation
- `/api/stripe/webhook`:
  - Verify signature with `stripe.webhooks.constructEvent()`
  - Atomic claim: UPDATE webhook_events WHERE status = 'pending' RETURNING id
  - Process subscription upsert + mark processed INSIDE A SINGLE DATABASE TRANSACTION
  - Handle checkout.session.completed, customer.subscription.*, invoice.paid, invoice.payment_failed
  - Log unknown event types without crashing
- `lib/entitlements.ts` reading `BILLING_CONFIG.pastDueGracePeriod` from `lib/config.ts`
-
```
