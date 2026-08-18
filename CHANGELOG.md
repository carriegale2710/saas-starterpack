# Changelog

All notable changes to this project are documented here.
Follows [Keep a Changelog](https://keepachangelog.com) conventions.

---

## [Unreleased] — Stage 3: Supabase Authentication

---

## Stage 2 — Post-Scaffold Fixes
_2026-08-19_

### Fixed
- `package.json` — added 5 missing Radix UI peer dependencies required by shadcn-style components:
  `@radix-ui/react-slot`, `react-label`, `react-separator`, `react-avatar`, `react-dropdown-menu`
- `components/ui/input.tsx` — replaced empty `interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}` with `type InputProps = ...` to resolve `@typescript-eslint/no-empty-object-type` build error
- `docs/decisions.md` — added Decision #13: npm audit flag review and corrected risk assessment

### Security audit review (next@15.5.23 — latest stable 15.x)
- `postcss` ≤8.5.22 XSS (GHSA-qx2v-qp2m-jg93) — **not exploitable**: build-tool use only; attack requires runtime user CSS re-embedding which Next.js never does
- `postcss` source map path traversal — **not exploitable**: source maps generated from own source files, not attacker input
- `sharp` <0.35.0 libvips CVEs — **low risk at Stage 2**: only relevant if `next/image` serves user-uploaded images; reassess at Stage 7
- `esbuild` ≤0.24.2 dev-server interception — **dev-only, moderate**: fix deferred to Stage 6 via `vitest@^4.0.0` upgrade
- `npm audit fix --force` must not be run — would silently upgrade to `next@16.3.1` (breaking major)

---

## Stage 2 — Project Foundation
_2026-08-18_

### Added
- `package.json` — Next.js 15, React 19, Node ≥22, Vitest, `validate` script (`lint && typecheck && test`)
- `tsconfig.json` — TypeScript strict mode, `@/*` path alias
- `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- `.eslintrc.json`, `.prettierrc`, `.nvmrc` (Node 22), `vercel.json` (syd1)
- `vitest.config.ts`, `components.json` (shadcn/ui config)
- `.env.example` — all env vars documented; Supabase/Stripe sections commented for Stages 3–4
- `lib/config.ts` — central product config (`APP_CONFIG`, `BILLING_CONFIG`, nav arrays)
- `lib/env.ts` — Zod-validated environment variables
- `lib/utils.ts` — `cn()` Tailwind merge helper
- App routes: `/`, `/pricing`, `/login`, `/signup`, `/forgot-password`, `/reset-password`
- App routes: `/dashboard`, `/profile`, `/billing` (protected, placeholder auth)
- `app/not-found.tsx`, `app/error.tsx`, `app/(dashboard)/dashboard/loading.tsx`, `error.tsx`
- UI components: Button, Card, Input, Label, Badge, Separator, Avatar, Skeleton, DropdownMenu
- `components/marketing/` — `MarketingNav`, `MarketingFooter`
- `components/dashboard/` — `DashboardNav` with user dropdown
- `components/shared/` — `UnauthorizedMessage`, `EmptyState`
- `tests/config.test.ts` — verifies `BILLING_CONFIG.pastDueGracePeriod === false`
- `tests/env.test.ts` — documents env validation requirement

### Conventions locked in
- `npm` exclusively; no pnpm or yarn
- `lib/` at project root; no `src/lib/`
- `BILLING_CONFIG.pastDueGracePeriod: false` — `past_due` denies access by default
- All product values centralised in `lib/config.ts`

---

## Stage 1 — Architecture Plan
_2026-08-18_

### Added (Perplexity Pro re-roll)
- `docs/implementation-plan.md` — phased build checklist with acceptance gates
- `docs/schema.md` — authoritative database contract (`profiles`, `subscriptions`, `webhook_events`)
- `docs/decisions.md` — 12+ approved architectural decisions
- `README.md` — setup, deployment, migration, and operational runbook
- `CLAUDE.md` — non-negotiable implementation conventions and security rules
- `docs/prompt-plan.md` — eight-stage workflow assigning Perplexity Pro / Claude Free / local tools
- `docs/archive/stage1-version-comparison.md` — notes on Claude→Perplexity Pro re-roll and what changed
- `docs/archive/reference-only.md` — reference material from earlier iterations
- `docs/guides/` — Perplexity GitHub connector usage guide
- `docs/microsaas-playbook/` — research notes from NotebookLM on tech stack decisions

### Key architectural decisions
- Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, Supabase, Stripe, Vercel
- `webhook_events` as canonical table name (not `stripe_events`)
- Atomic webhook claim: `INSERT ... ON CONFLICT DO NOTHING`
- `pending → processing → processed / failed` webhook states
- Subscription upsert + event status update in one DB transaction
- Stale-processing recovery via `webhook_events.updated_at` timeout
- `past_due` defaults to no access; controlled via `lib/config.ts`
- Service-role bypasses RLS entirely — no `auth.uid() IS NULL` policies
- Stripe Node SDK pinned in `package.json`; API version in `STRIPE_API_VERSION`
- Optional modules isolated under `lib/modules/`; none included by default

### Iterations
- Initial Claude Free architecture → Perplexity Pro re-roll (docs overwritten)
- Doc inconsistencies fixed (8 issues: npm standardisation, path aliases, table naming, RLS wording)
- `prompt-plan.md` updated to clarify Perplexity Pro / Claude Free task split
- Prompt plan refined with explicit Perplexity Pro steps per stage

---

## [Init] — Repository Setup
_2026-08-18_

### Added
- Repository created as `saas-starterpack`
- Initial Claude prompt instructions for building the starter
- `docs/` folder structure established
