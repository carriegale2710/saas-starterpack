# CLAUDE.md — Implementation Rules

<!-- Scope: implementation rules, security constraints, repository structure, naming, testing, and documentation maintenance. -->
<!-- Source of truth: use docs/decisions.md for rationale, risks, and pinned versions; use docs/implementation-plan.md for phase status. -->
<!-- Maintenance rule: edit existing content, do not append duplicate update blocks. -->

## Project Context

This is a **minimal, maintainable modular monolith** for solo-founder subscription SaaS products. Every decision prioritizes shipping speed, maintainability, and security.

---

## Core Stack (Non-Negotiable)

- **Next.js 15** with App Router (Server Components by default)
- **TypeScript** in strict mode
- **Tailwind CSS** for styling
- **shadcn/ui-style** components (copy-paste, not library)
- **Supabase PostgreSQL** with Row Level Security
- **Supabase Auth** (email/password + OAuth)
- **Stripe** (Checkout, Customer Portal, Webhooks) — Phase 2
- **Vercel** for deployment
- **npm** — do not switch to pnpm or yarn; npm is pre-installed with Node and avoids lockfile conflicts. The lockfile is `package-lock.json` — commit it, never `.gitignore` it.
- **Node.js 22 LTS** — target runtime. Node 20 is deprecated on Vercel from October 2026. `.nvmrc` pins `22`.

---

## Repository Structure

```text
/
├── app/                    # Routes and layouts
├── components/             # ui, marketing, dashboard, shared
├── lib/                    # Canonical application logic; never create src/lib/
│   ├── vendor/             # Supabase and Stripe integrations
│   ├── modules/            # Optional modules
│   ├── config.ts           # Product and billing configuration
│   ├── database.types.ts   # Generated Supabase types
│   ├── env.ts              # Zod environment validation
│   └── entitlements.ts     # Subscription access logic
├── supabase/migrations/    # Database migrations
├── tests/                  # Vitest tests and fixtures
├── docs/
│   ├── archive/            # Superseded drafts
│   ├── guides/             # Task-specific procedures and AI workflow guidance
│   ├── playbook/           # Product and delivery playbook
│   ├── architecture.md     # System behaviour and data flow
│   ├── decisions.md        # Decision rationale, risks, and pinned versions
│   ├── implementation-plan.md # Current phase and task status
│   ├── schema.md           # Database contract and RLS expectations
│   ├── toolchain.md        # Tooling conventions
│   └── prompt-plan.md      # Agent workflow prompts
├── .github/workflows/ci.yml
├── AGENTS.md               # Tool-agnostic agent orientation
├── CHANGELOG.md            # User-facing release history
├── README.md               # Setup, usage, migration, and deployment
└── CLAUDE.md               # Claude-specific implementation rules
```

The tree above is the repository-structure source of truth. Update it in the same change whenever a file or directory is added, moved, renamed, or deleted.

**Naming rules:**

- Use `lib/` at the project root. Never use `src/lib/` or mix the two.
- The webhook event log table is named `webhook_events` everywhere — in SQL, code, and docs. Never use `stripe_events`.
- Nav links (`MARKETING_NAV`, `DASHBOARD_NAV`) live in `lib/config.ts` — single source of truth. Never duplicate them in component files.

## Implementation Rules

### 1. Boundaries and naming

- Use `lib/` at the project root. Never use `src/lib/` or mix the two.
- Keep vendor-specific code in `lib/vendor/`.
- Keep optional features in `lib/modules/`; do not include them in the core by default.
- Use descriptive, domain-specific names. Avoid generic `utils.ts`, `helpers.ts`, `data.ts`, `store.ts`, and `misc/`.
- Use `index.ts` only as a module’s public API entry point.
- Keep navigation arrays in `lib/config.ts`; do not duplicate them in components.
- The webhook event log table is named `webhook_events` everywhere — in SQL, code, and docs. Never use `stripe_events`.

### 2. Security Constraints

#### Supabase Service-Role Key

**NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code.

```typescript
// ✅ CORRECT: Server-side only (api/routes)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Server-only
);

// ✅ CORRECT: Client-side (components, pages)
import { createBrowserClient } from '@supabase/ssr';
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

- Validate environment variables through `lib/env.ts`; never read required configuration directly from `process.env` in application logic.

#### Row Level Security

All database tables **MUST** have RLS enabled. Default policy: **deny all**, then explicitly allow. Service-role access bypasses RLS unconditionally — never simulate it with an `auth.uid() IS NULL` policy. Full RLS expectations → [`docs/schema.md`](./docs/schema.md#rls-expectations).

```sql
-- ✅ CORRECT: Explicit user access
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- ❌ WRONG: Never disable RLS
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

#### Stripe Webhooks

- Treat webhooks as **source of truth** for subscription state
- Never trust client-side subscription updates
- Validate webhook signatures with `stripe.webhooks.constructEvent()`
- Log all events to `webhook_events` table (idempotency)
- Only 5 event types trigger a subscription upsert — see [`docs/schema.md` → Entitlement-Controlling Events](./docs/schema.md#entitlement-controlling-events)
- All other event types must be logged and acknowledged (200) without crashing

#### Webhook Transaction Boundary

The subscription upsert and `status = 'processed'` update **must execute in the same database transaction**. A crash must never leave a permanently misleading `processing` row.

```typescript
// lib/vendor/supabase/server.ts — inside webhook handler
await supabase.rpc('process_webhook_event', { event_id, subscription_data });
// The RPC wraps both writes in a single transaction.
```

Stale `processing` rows are recovered by a timeout reset — see [`docs/schema.md` → Atomic Webhook Processing](./docs/schema.md#atomic-webhook-processing) for the full SQL.

### 3. Entitlement Policy

The `past_due` access decision is a **product decision** defined in `lib/config.ts`:

```typescript
// lib/config.ts
export const BILLING_CONFIG = {
  // Default: deny access on past_due. Set to true only if you deliberately
  // want a grace period (e.g., read-only access while Stripe retries payment).
  pastDueGracePeriod: false,
} as const;
```

Keep product policy in `lib/config.ts`. In particular, `lib/entitlements.ts` must read the `pastDueGracePeriod` policy rather than hard-code it. Full entitlement status table → [`docs/schema.md` → Entitlement Logic](./docs/schema.md#entitlement-logic).

Pinned versions and upgrade rationale belong in [`docs/decisions.md`](./docs/decisions.md), not here. Do not duplicate version tables or risk analysis.

### 4. Scope Boundaries

#### Core Features (Mandatory)

- Public marketing page (`/`)
- Authentication (`/login`, `/signup`) and OAuth callback (`/auth/callback` — exchanges the code for a session via `supabase.auth.exchangeCodeForSession()`, then redirects to `/dashboard`)
- Password recovery (`/forgot-password`, `/reset-password`)
- Protected dashboard (`/dashboard`)
- User profile (`/profile`)
- Supabase database access (with RLS)
- Stripe Checkout (`/api/stripe/checkout`)
- Stripe Customer Portal (`/api/stripe/portal`)
- Stripe webhook synchronization (`/api/stripe/webhook`)
- Subscription entitlements (`lib/entitlements.ts`)
- Central product configuration (`lib/config.ts`)
- Environment validation (`lib/env.ts`)
- Basic tests (Vitest)
- README and CLAUDE.md

#### Optional Modules (Do Not Include by Default)

See [`docs/guides/adding-a-module.md`](./docs/guides/adding-a-module.md) for the full module contract and scaffold steps.

- `lib/modules/workspaces/` — **requires new schema tables and may need a billing-owner relationship**
- `lib/modules/usage-billing/` — **requires new schema tables and billing-owner changes**
- `lib/modules/storage/`
- `lib/modules/email/`
- `lib/modules/analytics/`
- `lib/modules/sentry/`
- `lib/modules/ai/`
- `lib/modules/jobs/`

### 5. Vendor Code Isolation

All Supabase and Stripe code **MUST** be isolated in `lib/vendor/`. Makes vendor lock-in explicit; easier to swap if needed.

### 6. Environment Validation

`lib/env.ts` uses Zod to validate all required env vars at startup.

**Phase 1 schema (current):**

```typescript
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});
```

**Phase 2 additions (to be added with Stripe work):**

```typescript
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_ID_PRO: z.string().startsWith("price_"),
  STRIPE_API_VERSION: z.string().min(1),
```

**Validation runs on:** `npm run dev`, `npm run build`, Vercel deployment.

**`tests/setup.ts` rule:** if `lib/env.ts` adds a new required variable, add a matching stub in `tests/setup.ts`. Never put real keys there.

### 7. Stripe SDK & API Version Pinning

<!-- sync: docs/decisions.md Decision #12 and Decision #16 own the specific version values. -->

Pin **both** the Node SDK version in `package.json` and the API version string in `.env.local`. Upgrade them together and run the full test suite before deploying.

> **Current pinned values:** See [`docs/decisions.md` Decision #12](./docs/decisions.md) for the SDK version and API version string. Do not update those values here.
>
> **⚠️ Before upgrading to `stripe@18`:** Read Decision #16 first — it documents a breaking schema change affecting `current_period_start/end` field paths.

```typescript
// lib/vendor/stripe/client.ts
import Stripe from 'stripe';
import { env } from '@/lib/env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
});
```

**Never** read `apiVersion` from `process.env` directly — always go through the validated `env` object.

### 8. Database Types

`lib/database.types.ts` is generated from the live Supabase schema. Regenerate it after every migration:

```bash
npx supabase gen types typescript --project-id <project-ref> > lib/database.types.ts
```

Keep type aliases in sync when the schema changes:

```typescript
export type SubscriptionStatus = Database['public']['Enums']['subscription_status'];
export type WebhookEventStatus = Database['public']['Enums']['webhook_event_status'];
```

Never leave `lib/database.types.ts` empty or with placeholder types — CI will catch the type errors.

### 9. Nav Links

`MARKETING_NAV` and `DASHBOARD_NAV` are exported from `lib/config.ts` — single source of truth for all navigation. Components must import from there, never define their own arrays. `nav.test.ts` asserts shape, label uniqueness, and group isolation — update it if the nav shape changes.

## 10. Testing and CI

**Framework:** Uses Vitest. `tests/setup.ts` stubs all env vars required by `lib/env.ts`. Configured via `vitest.config.ts` `setupFiles`. Refer to current test suite coverage in `tests/README.md`.

**Maintenance:** Maintain tests for configuration, entitlements, environment validation, navigation, RLS, webhooks, and billing as their phases activate. Keep `tests/setup.ts` aligned with required environment variables; never use real credentials in tests.

**CI:** GitHub Actions at `.github/workflows/ci.yml` -> Runs validation, build, and tests. All required CI jobs must pass before merging. When implementation changes, update tests; when test files or statuses change, update the test inventory in this file.

### 12. Deployment

**Platform:** Vercel (free tier). Region: `syd1`. See `vercel.json` for build config.

---

## Documentation System

Each documentation file owns one concern. Write the smallest accurate update in the file that owns the information, then link to it elsewhere.

| File                          | Owns                                            | Does not own                               |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `AGENTS.md`                   | Short orientation, commands, and navigation     | Detailed implementation rules or rationale |
| `CLAUDE.md`                   | Implementation rules and repository constraints | Version rationale, risks, or phase status  |
| `docs/architecture.md`        | System behaviour and data flow                  | Decision rationale                         |
| `docs/schema.md`              | Database and RLS contract                       | Product reasoning                          |
| `docs/decisions.md`           | Rationale, risks, and pinned versions           | General implementation instructions        |
| `docs/implementation-plan.md` | Current phases and task status                  | Detailed prompts                           |
| `docs/prompt-plan.md`         | Agent prompt/workflow text                      | Overall project status                     |
| `docs/guides/*`               | Specific procedures and practices               | Core architectural rules                   |
| `README.md`                   | User setup and operation                        | Internal agent rules                       |
| `CHANGELOG.md`                | Concise user-facing release history             | Internal reasoning or progress notes       |

### Mandatory documentation hygiene

- Read the relevant source-of-truth document before editing.
- Edit existing sections; never append a duplicate “Update” or “Notes” section.
- Do not copy content between docs. Link to the owner instead.
- Add documentation only when behaviour, workflow, structure, or a user-facing change requires it.
- Prefer one precise example over several explanatory paragraphs.
- Remove stale, repeated, or superseded text during the same edit.
- Keep changes proportional: a one-line code change normally needs no documentation update.
- Do not create a new documentation file unless no existing file owns the topic.
- If a proposed edit would materially increase a file’s length, first identify content to trim, merge, or extract.
- Stop and ask before expanding a living document with speculative guidance.
- Do not rewrite an entire documentation file when a targeted edit is sufficient.

> Refer to `docs/guides/ai-agent-tips.md` for more documentation principles and best practices.

### Changelog rules (`CHANGELOG.md`)

Add a concise entry to `CHANGELOG.md` only for a user-facing feature, breaking change, important bug fix, security change, or meaningful repository/deployment change. One entry should normally be one sentence. Do not record every file edit, test run, refactor, or documentation cleanup. It should record only WHAT changed without extra explainations on why or how.

## Decisions log rules (`docs/decisions.md`)

`docs/decisions.md` records durable architectural or product decisions, their rationale, important trade-offs, rejected alternatives, and upgrade or migration consequences. Add an entry only when a choice affects system boundaries, security, data, dependencies, workflow, or future implementation; do not use it for ordinary implementation notes, temporary experiments, task progress, or changes already explained by the code.

When adding or revising an entry, preserve the existing numbered structure and table of contents, use the format **Decision / Why / Consequences or rejected alternatives**, update related links, and revise the existing decision rather than appending a duplicate. Keep implementation rules in `CLAUDE.md`, phase status in `docs/implementation-plan.md`, and user-facing changes in `CHANGELOG.md`; link to those files instead of copying their content. Archive or remove superseded decisions only when their historical context is no longer useful, and never silently rewrite the rationale for an accepted decision.

### Documentation edit checklist

Before finishing a documentation change, verify:

- The information is in the correct owner file.
- No existing section already says the same thing.
- Cross-references point to the owner rather than duplicating content.
- Stale wording and obsolete examples were removed.
- The directory tree and test inventory are current if affected.
- The diff is smaller than or comparable to the value of the change.

> For a substantial documentation change, run a DRY audit using the phrase: `audit documentation for DRYness`.

## Keeping This File Fresh

- File or directory change → update the repository tree here.
- Implementation convention change → update this file and record rationale in `docs/decisions.md`.
- Version or risk change → update `docs/decisions.md` only, then link here if necessary.
- Test file or status change → update the test inventory.
- Phase change → update `docs/implementation-plan.md`, not this file.
- New stage → re-read and verify against `docs/decisions.md`

---

**Remember:** This is a **starter repository**, not a production SaaS. Ship fast, iterate, add complexity only when needed.
