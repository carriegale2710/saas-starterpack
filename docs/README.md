# Docs Index

This folder contains all living documentation for the saas-starterpack project. Start here if you're new to the repo or beginning a new AI session.

---

## Reading Order (New Sessions)

For AI-assisted sessions, read in this order before touching any file:

1. [`../AGENTS.md`](../AGENTS.md) — orientation map: stack, commands, directory map, where-to-find-things
2. [`../CLAUDE.md`](../CLAUDE.md) — repo rules, naming conventions, and AI session constraints
3. [`decisions.md`](./decisions.md) — all architectural decisions, trade-offs, and rejected alternatives
4. [`architecture.md`](./architecture.md) — system data flow, request lifecycles, entitlement logic
5. [`schema.md`](./schema.md) — canonical database schema, RLS policies, entitlement logic
6. [`implementation-plan.md`](./implementation-plan.md) — current stage, acceptance gates, and task breakdown
7. [`prompt-plan.md`](./prompt-plan.md) — per-stage AI workflow and prompt templates

---

## Reference Docs

| File | Purpose |
|---|---|
| [`architecture.md`](./architecture.md) | System layers, request flows, auth flow, entitlement logic |
| [`decisions.md`](./decisions.md) | Architectural decision log — why things are the way they are |
| [`schema.md`](./schema.md) | Full Supabase PostgreSQL schema, RLS, migrations, entitlement table |
| [`toolchain.md`](./toolchain.md) | AI toolchain setup, model selection, session startup checklist |
| [`implementation-plan.md`](./implementation-plan.md) | Staged build plan with acceptance gates |
| [`prompt-plan.md`](./prompt-plan.md) | Per-stage prompt workflow for Perplexity + GitHub MCP sessions |

---

## Subdirectories

### `guides/`
How-to and reference guides.

| File | Purpose |
|---|---|
| [`guides/ai-agent-tips.md`](./guides/ai-agent-tips.md) | File structure and documentation tips optimised for AI agent workflows |
| [`guides/adding-a-module.md`](./guides/adding-a-module.md) | How to scaffold and remove an optional feature module |
| [`guides/perplexity-github-connector.md`](./guides/perplexity-github-connector.md) | Setting up and using the Perplexity → GitHub MCP connector |
| [`guides/perplexity-supabase-connector.md`](./guides/perplexity-supabase-connector.md) | Setting up and using the Perplexity → Supabase MCP connector |

### `playbook/`
Opinionated strategy guides for solo SaaS founders. Separate from factual specs.

| File | Purpose |
|---|---|
| [`playbook/lean-techstack.md`](./playbook/lean-techstack.md) | Rationale for the lean stack choices |
| [`playbook/mvp-dos-vs-donts.md`](./playbook/mvp-dos-vs-donts.md) | MVP scope rules and anti-patterns |

### `archive/`
Superseded or reference-only documents. Do not treat as current.

| File | Purpose |
|---|---|
| [`archive/reference-only.md`](./archive/reference-only.md) | Historical reference material |
| [`archive/stage1-version-comparison.md`](./archive/stage1-version-comparison.md) | Stage 1 dependency version comparison (superseded) |

---

## Key Conventions

- **Canonical path:** `lib/` — never `src/lib/`
- **Canonical table names:** `profiles`, `subscriptions`, `webhook_events` — never aliased
- **This file** should be updated whenever a new doc is added to `docs/`
