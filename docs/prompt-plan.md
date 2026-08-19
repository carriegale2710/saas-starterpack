# Prompt Plan — Perplexity Pro + GitHub MCP + Local Tools

> **Living document** — update stage checklists, prompts, and notes whenever a stage completes or a convention changes.

Use an **eight-stage workflow**. Each stage has a defined tool assignment:

- **Perplexity Pro** — research, architecture, decisions, vendor guidance, independent review, doc maintenance, and direct implementation via GitHub MCP connector between stages
- **GitHub MCP connector** — direct file commits, code implementation, and repository management (replaces Claude Free for code generation)
- **Local tools** — Git, VS Code, Supabase CLI, Stripe CLI, Vitest, Playwright, and the test suite

Perplexity Pro + GitHub MCP works best with a single focused task per session. Keep each prompt scoped to one stage. Never ask GitHub MCP to research, decide architecture, or review external APIs — use Perplexity Pro for that.

---

## Project Conventions

These conventions apply throughout every stage:

- Use **npm exclusively**. Do not use pnpm or yarn.
- Commit `package-lock.json`; do not commit `pnpm-lock.yaml` or `yarn.lock`.
- Use `lib/` as the canonical application-library directory. Never use `src/lib/`.
- Use `webhook_events` as the canonical webhook table name. Never use `stripe_events`.
- The initial database migration is `supabase/migrations/0001_initial.sql`.
- The service-role key bypasses RLS entirely. Do not create `auth.uid() IS NULL` policies.
- `past_due` denies premium access by default. Controlled centrally by `lib/config.ts`.
- Pin the Stripe Node SDK in `package.json` and record the Stripe API version in `STRIPE_API_VERSION`. Current pinned values are in `docs/decisions.md` Decision #12.
- Workspaces and usage-based billing may require core-table relationships or billing-owner changes; they are not automatically schema-neutral.
- Nav links live in `lib/config.ts` only — never duplicate them in component files.
- `lib/database.types.ts` is generated from the live schema — regenerate after every migration.
- `tests/setup.ts` stubs must stay in sync with `lib/env.ts` required vars and `.github/workflows/ci.yml env:`.

---

## Living Document Policy

Perplexity Pro must update the following files as part of completing each stage — not as a separate cleanup pass:

| File | Update when |
|---|---|
| `docs/implementation-plan.md` | Task completed, gate passed, or decision changed |
| `docs/prompt-plan.md` | Stage completed, checklist ticked, or prompt refined |
| `CHANGELOG.md` | Any commit with functional or structural changes |
| `README.md` | Routes, env vars, setup steps, or stack changed |
| `CLAUDE.md` | Convention added, renamed, or removed |
| `docs/decisions.md` | Any version number, risk, or ADR rationale changes |
| `tests/README.md` | Test files added, changed, or skeleton activated |

---

## Documentation Layout

The architecture stage produces a split documentation set:

- `docs/implementation-plan.md` — concise execution checklist (living); phases, gates, task lists only
- `docs/schema.md` — authoritative database contract
- `docs/decisions.md` — approved architectural choices (ADRs), risks, non-goals, pinned version values
- `docs/prompt-plan.md` — this file (living)
- `README.md` — setup, operations, migration, deployment, and rationale
- `CLAUDE.md` — implementation conventions and non-negotiable security rules; points to `decisions.md` for version values
- `CHANGELOG.md` — versioned change log
- `tests/README.md` — test suite documentation

**Single-ownership rule:** version numbers and risks live in `docs/decisions.md` only. `CLAUDE.md` and `implementation-plan.md` reference them; they do not duplicate them.

---

## Tool Assignment by Stage

| Stage | Perplexity Pro | GitHub MCP | Local tools |
| --------------------- | --------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| Architecture plan | Draft architecture and research vendors | — | Review docs in VS Code |
| Foundation | Verify current Next.js and npm guidance | Scaffold app, config, shell, layout | `npm run dev`, lint, build |
| Supabase auth/RLS | Check SSR approach and current SDK docs | Implement auth, migrations, RLS | `npx supabase db reset`, type generation, tests |
| Stripe billing | Verify webhook events and SDK version | Implement billing, webhooks, gates | `stripe listen`, Vitest |
| Optional integrations | Research module setup if needed | Implement selected modules only | Environment toggle tests, build |
| Testing/docs | Review documentation accuracy | Add missing tests, fix docs | Vitest, Playwright, build |
| Security review | Independent security audit | Fix confirmed critical/high issues | Full test suite, `git diff` |
| Final validation | Independent release-readiness review | Final validation fixes | Clean checkout, all checks |

---

## Per-Stage Workflow

For every stage, follow this loop:

1. **Perplexity Pro** — research current requirements, vendor docs, and breaking changes. Update `docs/` if a decision changes.
2. **Read `CLAUDE.md` and `docs/decisions.md`** — verify they are consistent and up to date before writing any code.
3. **GitHub MCP** — implement the stage directly via file commits. Read the repository before editing.
4. **Local tools** — run tests and verification commands.
5. **Perplexity Pro, if needed** — independently review issues involving Stripe, Supabase, RLS, security, or current external APIs.
6. **Git** — review `git diff` before committing.
7. **Perplexity Pro** — update all living documents as part of the stage close, not as a later cleanup.

---

## When to Escalate to Perplexity Pro

Use Perplexity Pro before implementing when:

- A Supabase SSR, cookie, or middleware error appears
- A Stripe webhook event name or field is uncertain
- RLS policies behave unexpectedly
- A test failure involves an external API contract
- A security question arises that cannot be reliably answered from the codebase alone

Perplexity Pro is the source of truth for current external APIs. GitHub MCP is the source of truth for the code already in the repository.

---

## When Claude Pro Becomes Worthwhile

Consider using Claude Pro (via API or Claude.ai) when:

- More time is spent reconstructing context than writing code
- Long multi-file debugging sessions are required
- You want an agent that can inspect, edit, test, and iterate in one workflow
- You are actively shipping multiple SaaS products every week

Complete Stage 4 with the current combination first. If GitHub MCP limits materially slow down Stage 4 or 5, consider Claude Pro for one month and reassess.

---

## Recommended Git Checkpoints

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

# Before Starting

## Create the Repository

```bash
mkdir saas-starterpack
cd saas-starterpack
git init
```

---

# Stage 1: Architecture

**Perplexity Pro stage — do not use GitHub MCP here.**

## Status: COMPLETE ✅

## Purpose

Produce architecture documentation without writing application code.

## Prompt

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

## Completed Record

- [x] npm-only commands and `package-lock.json`
- [x] `lib/` used consistently; no `src/lib/`
- [x] `webhook_events` used consistently; no `stripe_events`
- [x] Atomic webhook claiming with `INSERT ... ON CONFLICT DO NOTHING`
- [x] Explicit `pending`, `processing`, `processed`, and `failed` states
- [x] Subscription upsert and event status update in one transaction
- [x] Stale-processing recovery using `updated_at`
- [x] `invoice.paid` in the entitlement-controlling event set
- [x] `past_due` defaulting to no access through `lib/config.ts`
- [x] Service-role bypassing RLS without an `auth.uid() IS NULL` policy
- [x] Password recovery request and callback flows
- [x] `updated_at`, constraints, and unknown-status handling
- [x] `supabase/migrations/0001_initial.sql`
- [x] Module schema-impact warnings
- [x] Documentation split across all required files

> **Note:** Stage 1 was redone by Perplexity Pro after initial Claude attempt. See `docs/archive/stage1-version-comparison.md`.

---

# Stage 2: Project Foundation

**Perplexity Pro and GitHub MCP stage.**

## Status: COMPLETE ✅

## Perplexity Pro Step

Before implementing, use Perplexity Pro to verify:

- The current Next.js App Router setup approach
- The current shadcn/ui initialization approach
- The supported Node.js version
- npm installation and lockfile conventions
- Relevant breaking changes in the current Next.js ecosystem

Confirm that the project will use npm exclusively with `package-lock.json`.

Confirm that application-library code belongs under `lib/`, not `src/lib/`.

Update `docs/decisions.md` if the research changes an architectural decision.

## Implementation Prompt

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

- Next.js version: 15 (current stable). Use create-next-app@latest.
- Do NOT use --src-dir flag. All code at root: app/, lib/, components/.
- params, searchParams, cookies(), headers() are all async in Next.js 15 — always await them.
- fetch() is uncached by default. Do not rely on implicit caching.
- Turbopack is default for next dev — no need to add --turbo flag explicitly.
- shadcn/ui CLI: npx shadcn@latest init (not shadcn-ui)
- Node.js target: 22 LTS. Add engines.node >=22.0.0 to package.json.
- npm only. Generates package-lock.json. No pnpm-lock.yaml or yarn.lock.
- Keep product names, URLs, branding, and feature flags centralized
- Do not hard-code product-specific values
- Keep the UI product-neutral
- Avoid unnecessary client components
- Do not add database, Stripe, email, analytics, or monitoring code yet
- Add a `validate` script to package.json that runs: npm run lint && npm run typecheck && npm run test
- Use these placeholder values in lib/config.ts: APP_NAME "SaaS Starter", APP_URL from NEXT_PUBLIC_APP_URL env, SUPPORT_EMAIL "support@example.com"
- Scaffold these shadcn/ui components only: Button, Card, Input, Label, Badge, Separator, Avatar, DropdownMenu
- Do not create src/ directory at all — all application code lives at root lib/, app/, components/

## Verification

Run formatting, lint, type checking, and a production build.

At the end, report files changed, commands run, assumptions, known limitations, and the recommended next phase.

This project uses Next.js 15. Apply these patterns:
- await params and searchParams in all layouts, pages, and route handlers
- await cookies() and headers() everywhere
- fetch() is not cached by default — add cache: 'force-cache' only when explicitly needed
- GET Route Handlers are dynamic by default
- Turbopack is the default dev bundler (next dev runs Turbopack)
```

## Completed Record

- [x] Next.js 15 App Router with TypeScript strict mode
- [x] Tailwind CSS + shadcn/ui-style components
- [x] `lib/config.ts` with `APP_CONFIG`, `BILLING_CONFIG`, `MARKETING_NAV`, `DASHBOARD_NAV`
- [x] `lib/env.ts` Zod validation (Phase 1 vars)
- [x] `.env.example`
- [x] `README.md` and `CLAUDE.md` foundation
- [x] Node 22 LTS pinned in `.nvmrc` and `package.json engines`

---

# Stage 3: Supabase Authentication

**Perplexity Pro and GitHub MCP stage.**

## Status: COMPLETE ✅

## Perplexity Pro Step

Before implementing, use Perplexity Pro to verify:

- The current `@supabase/ssr` approach for Next.js App Router
- Current Supabase browser and server client patterns
- Current session-refresh and middleware guidance
- Current Supabase CLI migration commands
- Current Supabase type-generation commands
- Relevant changes to Supabase Auth or RLS behaviour

Ask Perplexity Pro to identify deprecated helpers or examples that might be used incorrectly.

Update `docs/decisions.md`, `docs/schema.md`, or `README.md` if the research changes the implementation approach.

## Implementation Prompt

```text
Implement the Supabase authentication and database foundation described in the approved plan.

Before editing:

1. Read CLAUDE.md.
2. Read docs/implementation-plan.md, docs/schema.md, and docs/decisions.md.
3. Inspect the existing application structure.
4. Inspect current Next.js and Supabase package versions.
5. Follow the current @supabase/ssr approach. Do not use deprecated helpers.

## CRITICAL: Current Supabase SSR patterns (2026)

Packages: @supabase/ssr + @supabase/supabase-js

DO NOT USE (deprecated):
- @supabase/auth-helpers-nextjs
- createServerComponentClient
- createPagesBrowserClient
- createMiddlewareClient
- get/set/remove cookie adapter

USE INSTEAD:
- createBrowserClient from @supabase/ssr (browser/client components)
- createServerClient from @supabase/ssr with getAll/setAll cookie adapter (server)
- await cookies() — cookies() is async in Next.js 15
- await createClient() — server client factory must be async
- getUser() for ALL server-side auth checks — never getSession() (can be spoofed)
- middleware.ts at project root using createServerClient; must return supabaseResponse

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

## Completed Record

- [x] `@supabase/ssr` browser + server clients
- [x] Session middleware
- [x] Auth routes: `/login`, `/signup`, `/auth/callback`, `/forgot-password`, `/reset-password`
- [x] Protected `/dashboard`
- [x] `supabase/migrations/0001_initial.sql` applied
- [x] `lib/database.types.ts` generated; `SubscriptionStatus` and `WebhookEventStatus` aliases added
- [x] 5 Vitest suites, 20 tests, all passing
- [x] CI: lint ✅, typecheck ✅, build ✅, tests ✅
- [x] Test fixtures: `subscriptions.ts`, `webhook-events.ts`
- [x] Skeleton tests: `webhook.test.ts`, `billing.test.ts`
- [x] `webhook_events` RLS enabled — verified via `pg_class` (`relrowsecurity: true`)
- [x] Zero authenticated-user policies on `webhook_events` — verified via `pg_policies` (0 rows)
- [ ] Confirm service-role write to `webhook_events` works — **Phase 2.2 gate** (requires webhook handler to exist)

---

# Stage 4: Stripe Billing

**Perplexity Pro and GitHub MCP stage.**

## Status: IN PROGRESS 🔜

Stripe billing is high-risk. Complete the Perplexity Pro step fully before implementing.

## Perplexity Pro Step

Before implementing, use Perplexity Pro to verify:

- The current compatible Stripe Node SDK version
- The Stripe API version used by the project
- The relationship between SDK and API versions
- Current subscription lifecycle event names
- Required fields on subscription and invoice events
- Webhook signature-verification guidance
- The atomic database claim pattern
- The `invoice.paid` entitlement requirement
- Safe retry behaviour for failed webhook processing

Ask Perplexity Pro to specifically review:

- `INSERT ... ON CONFLICT DO NOTHING`
- `pending`, `processing`, `processed`, and `failed` states
- The transaction boundary between subscription upsert and event completion
- Stale-processing recovery using `updated_at`
- The default `past_due` entitlement policy

Update `docs/decisions.md`, `docs/schema.md`, and `README.md` before implementation if the research changes anything.

**Also confirm:** the Stripe env var stubs needed in `tests/setup.ts` and `.github/workflows/ci.yml env:` (four vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_API_VERSION`).

## Confirmed Versions (researched 2026-08-19)

<!-- sync: docs/decisions.md Decision #12 is the single source of truth for these values -->

- **Stripe Node SDK:** `stripe@17.x` — pin in `package.json`. See [Decision #12](./decisions.md).
- **Stripe API version:** `STRIPE_API_VERSION=2025-11-20.acacia` — latest stable pre-basil version. See [Decision #12](./decisions.md).
- **⚠️ Do not upgrade to `stripe@18`** without reading [Decision #16](./decisions.md) — breaking schema change affecting `current_period_start/end` field paths.
- **Webhook events:** 5 entitlement events confirmed correct (see fixtures)

## Implementation Prompt

```text
Implement the Stripe subscription module from the approved architecture plan.

Before editing:

1. Read CLAUDE.md, docs/implementation-plan.md, docs/schema.md, and docs/decisions.md.
2. Inspect the existing Supabase clients and database types.
3. Inspect the current Stripe SDK version.
4. Confirm the existing user and profile schema.
5. Do not redesign unrelated parts of the application.

## Implement

Stripe modules under lib/vendor/stripe/:
- client.ts — Stripe server client (initialised from validated env object)
- checkout.ts — createCheckoutSession(), includes user_id in session metadata
- portal.ts — createPortalSession()
- webhook.ts — parseWebhookEvent(), handleWebhookEvent()
- entitlements.ts — getCurrentSubscription(), hasActiveSubscription(), requireActiveSubscription()

Pages and routes:
- /pricing — plan selection from BILLING_CONFIG (no hardcoded price_ strings)
- /api/stripe/checkout — POST, server action or route handler
- /api/stripe/portal — POST
- /api/stripe/webhook — POST, raw body required (disable Next.js body parser)
- /billing — current subscription display + portal link

## Env vars to add
Add to .env.example, lib/env.ts Zod schema, tests/setup.ts stubs, AND .github/workflows/ci.yml env::
  STRIPE_SECRET_KEY=sk_test_placeholder
  STRIPE_WEBHOOK_SECRET=whsec_placeholder
  STRIPE_PRICE_ID_PRO=price_placeholder
  STRIPE_API_VERSION=2025-11-20.acacia

## Webhook requirements
- Verify Stripe signature — reject invalid with 400
- Atomic claim: INSERT INTO webhook_events (stripe_event_id, event_type, payload, status) VALUES ($1, $2, $3, 'pending') ON CONFLICT (stripe_event_id) DO NOTHING
- If claim returns 0 rows affected → duplicate, return 200 immediately
- Update status to 'processing', then wrap subscription upsert + update to 'processed' in ONE transaction
- On failure: rollback → status stays 'pending' or set to 'failed'
- Handle all 5 entitlement events; log and return 200 for unknown types
- NEVER use service-role client in browser code

## Entitlement policy (from BILLING_CONFIG)
- active, trialing → premium access
- past_due → no access (BILLING_CONFIG.pastDueGracePeriod is false by default)
- all others → no access
- missing subscription → no access

## Testing
Activate the skipped/commented assertions in:
- tests/webhook.test.ts (idempotency, event routing, stale-processing)
- tests/billing.test.ts (checkout contract, status coverage, BILLING_CONFIG policy)

Add new tests for:
- Invalid signature → 400
- Duplicate stripe_event_id → 200, no double-process
- Transaction rollback on processing failure
- Stale processing recovery (updated_at > 10 min threshold)
- Status mapping for all 7 DB statuses
- past_due denied by default via BILLING_CONFIG

Mock Stripe and Supabase — no real credentials needed in tests.

## Stale-processing recovery
Document this query in README.md under "Webhook Operations":
  UPDATE webhook_events
  SET status = 'pending', error = 'reset: stale processing'
  WHERE status = 'processing'
    AND updated_at < NOW() - INTERVAL '10 minutes';

## Verification
Run: npm run validate && npm run build
Report: files changed, tests added, assumptions, known limitations.
```

## Local Verification

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
npm test
```

Manual checks:

- [ ] Checkout and successful subscription
- [ ] Customer Portal
- [ ] Webhook delivery
- [ ] Duplicate webhook delivery
- [ ] Cancellation
- [ ] Payment failure
- [ ] Retry after processing failure
- [ ] Recovery of a stale processing row
- [ ] Confirm service-role write to `webhook_events` works (Phase 2.2 gate)

## Checkpoint

```bash
git add .
git commit -m "stage 4: Stripe billing"
```

---

# Stage 5: Optional Integrations

**Perplexity Pro and GitHub MCP stage.**

## Status: NOT STARTED ⏳

## Perplexity Pro Step

Before implementing, use Perplexity Pro to verify current setup and SDK guidance for each selected module:

- Resend
- PostHog
- Sentry
- Supabase Storage
- Workspaces
- Usage-based billing
- Background jobs

For every selected module, confirm:

- Current package and setup instructions
- Required environment variables
- Server-only versus browser-safe usage
- Whether the module requires a database migration
- Whether it affects `profiles`, `subscriptions`, or billing ownership
- How it can be disabled or removed safely

Pay particular attention to:

- Workspaces requiring workspace and membership relationships
- Usage-based billing requiring usage tables, metering relationships, or billing-owner changes

Update `docs/decisions.md`, `docs/schema.md`, `README.md`, and `docs/implementation-plan.md` if the research identifies schema or architectural impacts.

## Implementation Prompt

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
- Never use src/lib/
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

## Local Verification

Remove optional environment variables and confirm that the app still builds and runs.

If a selected module adds database changes:

```bash
npx supabase db reset
npx supabase db push
```

---

# Stage 6: Testing and Documentation

**Perplexity Pro and GitHub MCP stage.**

## Status: NOT STARTED ⏳

## Perplexity Pro Step

Audit the current documentation before implementing.

Verify:

- npm commands and `package-lock.json` usage
- `package.json` scripts referenced by the documentation
- Supabase CLI migration commands
- Supabase type-generation commands
- Current `@supabase/ssr` guidance
- Stripe CLI webhook commands
- Stripe event names
- Stripe SDK and API-version pinning
- Vercel deployment steps
- RLS and service-role wording
- `webhook_events` naming consistency
- `lib/` path consistency
- Initial migration requirements
- Atomic webhook transaction-boundary documentation
- Stale-processing recovery
- Default `past_due` denial policy
- Workspaces and usage-billing schema-impact warnings
- **`CLAUDE.md` consistent with `docs/decisions.md`** — check all `<!-- sync -->` markers

Apply documentation corrections before the implementation step.

## Implementation Prompt

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
- docs/prompt-plan.md

Use commands that actually exist in package.json. Use npm exclusively. Do not reference pnpm, yarn, src/lib/, or stripe_events.

## Verification

Run formatting, lint, type checking, unit tests, Playwright tests, and production build.

Fix documentation that references missing commands, missing files, or outdated conventions.
```

---

# Stage 7: Security Review

**Perplexity Pro for the audit brief; GitHub MCP applies confirmed fixes.**

## Status: NOT STARTED ⏳

## Perplexity Pro Step

Perform an independent security and correctness audit before changing the code.

Use current OWASP, Supabase, Stripe, and Next.js guidance where relevant.

Review authentication, authorization, Supabase RLS, Stripe webhooks, application security, and maintainability.

Produce findings ranked Critical / High / Medium / Low / Informational.

For every finding include: file reference, security or correctness impact, smallest safe fix, whether it blocks release, remaining risk after fix.

## Implementation Prompt

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

After fixes, run lint, type checking, unit tests, Playwright tests, and production build.

Create docs/security-review.md documenting findings, fixes applied, and remaining risks.
```

---

# Stage 8: Final Validation

**Perplexity Pro, GitHub MCP, and local validation stage.**

## Status: NOT STARTED ⏳

## Perplexity Pro Step

Perform an independent release-readiness review. Check all eight stages are represented, all conventions are consistent, all README commands match `package.json`, and all acceptance criteria are testable.

Return a concise release-readiness report with blocking issues separated from non-blocking improvements.

## Implementation Prompt

```text
Perform a final release-readiness check for this reusable SaaS template.

Do not add features.

Verify all acceptance criteria:

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

Report: final validation results, commands run, remaining manual setup steps, known limitations, recommended tag name.
```

## Local Verification

```bash
git clone . ../clean-test && cd ../clean-test
npm ci
cp .env.example .env.local
npm run dev
npm test
npm run build
```

```bash
grep -R "pnpm\|yarn\|src/lib\|stripe_events" . \
  --exclude-dir=node_modules \
  --exclude-dir=.git
```

## Final Commit and Tag

```bash
git add .
git commit -m "stage 8: final validation"
git tag v0.1.0-template
```
