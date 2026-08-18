# Prompt Plan — Perplexity Pro + GitHub MCP + Local Tools

> **Living document** — update stage checklists, prompts, and notes whenever a stage completes or a convention changes.

Use an **eight-stage workflow**. Each stage has a defined tool assignment:

- **Perplexity Pro** — research, architecture, decisions, vendor guidance, independent review, doc maintenance, and direct implementation via GitHub MCP connector between stages
- **GitHub MCP connector** — direct file commits, code implementation, and repository management (replaces Claude Free for code generation)
- **Local tools** — Git, VS Code, Supabase CLI, Stripe CLI, Vitest, Playwright, and the test suite

Perplexity Pro + GitHub MCP works best with a single focused task per session. Keep each prompt scoped to one stage.

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
- Pin the Stripe Node SDK in `package.json` and record the Stripe API version in `STRIPE_API_VERSION`.
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
| `tests/README.md` | Test files added, changed, or skeleton activated |

---

## Documentation Layout

The architecture stage produces a split documentation set:

- `docs/implementation-plan.md` — concise execution checklist (living)
- `docs/schema.md` — authoritative database contract
- `docs/decisions.md` — approved architectural choices (ADRs)
- `docs/prompt-plan.md` — this file (living)
- `README.md` — setup, operations, migration, deployment, and rationale
- `CLAUDE.md` — implementation conventions and non-negotiable security rules
- `CHANGELOG.md` — versioned change log
- `tests/README.md` — test suite documentation

Later stages must read the relevant documents and update all affected files when implementation changes a decision or contract.

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
2. **GitHub MCP** — implement the stage directly via file commits. Read the repository before editing.
3. **Local tools** — run tests and verification commands.
4. **Perplexity Pro, if needed** — independently review issues involving Stripe, Supabase, RLS, security, or current external APIs.
5. **Git** — review `git diff` before committing.
6. **Perplexity Pro** — update all living documents as part of the stage close, not as a later cleanup.

---

## When to Escalate to Perplexity Pro

Use Perplexity Pro before implementing when:

- A Supabase SSR, cookie, or middleware error appears
- A Stripe webhook event name or field is uncertain
- RLS policies behave unexpectedly
- A test failure involves an external API contract
- A security question arises

Perplexity Pro is the source of truth for current external APIs and architectural decisions.

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

**Perplexity Pro stage.**

## Status: COMPLETE ✅

## Purpose

Produce architecture documentation without writing application code.

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

Stripe billing is high-risk. Perplexity Pro researched vendor state before implementation.

## Confirmed Versions (researched 2026-08-19)

- **Stripe Node SDK:** `stripe@16.3.0` (pin exact in `package.json`)
- **Stripe API version:** `2025-01-27.acacia` — use whatever ships with the pinned SDK
- **Webhook events:** 5 entitlement events confirmed correct (see fixtures)

## Implementation Scope

New files:
- `lib/vendor/stripe/client.ts`
- `lib/vendor/stripe/checkout.ts`
- `lib/vendor/stripe/portal.ts`
- `lib/vendor/stripe/webhook.ts`
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/portal/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/(marketing)/pricing/page.tsx`
- `app/(dashboard)/billing/page.tsx`

Updated files:
- `package.json` — add `"stripe": "16.3.0"`
- `lib/env.ts` — add 4 Stripe Zod fields
- `.env.example` — add Stripe vars
- `tests/setup.ts` — add Stripe stubs
- `.github/workflows/ci.yml` — add Stripe stubs to `env:`
- `tests/webhook.test.ts` — activate commented assertions
- `tests/billing.test.ts` — activate commented assertions

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

---

# Stage 6: Testing and Documentation

**Perplexity Pro and GitHub MCP stage.**

## Status: NOT STARTED ⏳

---

# Stage 7: Security Review

**Perplexity Pro for the audit brief; GitHub MCP applies confirmed fixes.**

## Status: NOT STARTED ⏳

---

# Stage 8: Final Validation

**Perplexity Pro, GitHub MCP, and local validation stage.**

## Status: NOT STARTED ⏳

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
