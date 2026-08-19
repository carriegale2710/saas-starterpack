# AGENTS.md — Agent Orientation

> **Scope:** Quick-start context for any AI coding agent (Cursor, Copilot, Windsurf, etc.).
> **Not in scope:** Implementation rules, security constraints, test strategy — those live in `CLAUDE.md`.
> For Claude Code: read this file first, then `CLAUDE.md`.

---

## What This Repo Is

A minimal, modular SaaS starter for solo founders.  
Stack: **Next.js 15 · TypeScript · Tailwind · Supabase · Stripe · Vercel**  
Philosophy: ship fast, stay maintainable, add complexity only when needed.

---

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest
```

Package manager: **npm only** (do not use pnpm or yarn).

---

## Directory Map

```text
app/
  (marketing)/          # public pages
  (auth)/               # login, signup, password reset
  (dashboard)/          # protected pages
  api/stripe/           # checkout, portal, webhook routes
  api/auth/callback/    # OAuth code exchange
components/
  ui/                   # shadcn/ui-style primitives
  marketing/ · dashboard/ · shared/
lib/                    # ALL logic lives here — never src/lib/
  vendor/supabase/      # client.ts, server.ts, rls.ts
  vendor/stripe/        # client.ts, checkout.ts, portal.ts, webhook.ts
  modules/              # optional, opt-in feature modules
  config.ts             # nav arrays + BILLING_CONFIG (single source of truth)
  database.types.ts     # generated — never hand-edit
  env.ts                # Zod env validation
  entitlements.ts       # subscription access logic
supabase/migrations/    # SQL only — one file per change
tests/fixtures/         # mock subscription + webhook data
docs/                   # all project documentation
```

---

## Where to Find Things

| Question | File |
|---|---|
| Coding rules, naming, security constraints | `CLAUDE.md` |
| System data flow and architecture | `docs/architecture.md` |
| Why was X decided this way? | `docs/decisions.md` |
| What's left to build? | `docs/implementation-plan.md` |
| DB schema (tables, columns, RLS) | `docs/schema.md` |
| Pinned tool/dependency versions | `docs/toolchain.md` |
| Step-by-step coding prompts | `docs/prompt-plan.md` |
| Local dev setup from scratch | `docs/guides/local-setup.md` |
| How to scaffold an optional module | `docs/guides/adding-a-module.md` |

---

## Key Constraints (details in `CLAUDE.md`)

- Server Components by default — `"use client"` only when needed
- All logic in `lib/` — never `src/`
- `env.ts` validated object only — never `process.env` directly
- `lib/config.ts` is the single source of truth for nav and billing config
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never in client code
- RLS enabled on every table, default deny
- Stripe webhooks are the source of truth for subscription state
- `lib/database.types.ts` is generated — regenerate after every migration
- Skeleton test files (`webhook.test.ts`, `billing.test.ts`) are intentional — leave until Phase 2
