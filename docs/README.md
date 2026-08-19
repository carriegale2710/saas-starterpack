# Docs Index

This folder contains all living documentation for the saas-starterpack project.

---

## Reading Order & Reference

For AI-assisted sessions, read in this order before touching any file:

| # | File | Purpose |
|---|---|---|
| 1 | [`../AGENTS.md`](../AGENTS.md) | Orientation map: stack, commands, directory map, where-to-find-things |
| 2 | [`../CLAUDE.md`](../CLAUDE.md) | All implementation rules, naming conventions, security constraints |
| 3 | [`decisions.md`](./decisions.md) | Architectural decision log — why things are the way they are |
| 4 | [`architecture.md`](./architecture.md) | System layers, request flows, auth flow, entitlement logic |
| 5 | [`schema.md`](./schema.md) | Canonical DB schema, RLS policies, webhook processing, entitlement table |
| 6 | [`implementation-plan.md`](./implementation-plan.md) | Current stage, acceptance gates, task breakdown |
| 7 | [`toolchain.md`](./toolchain.md) | AI toolchain setup, model selection, session startup checklist |
| 8 | [`prompt-plan.md`](./prompt-plan.md) | Per-stage prompt workflow for Perplexity + GitHub MCP sessions |

---

## Guides

| File | Purpose |
|---|---|
| [`guides/ai-agent-tips.md`](./guides/ai-agent-tips.md) | File structure and doc tips optimised for AI agent workflows |
| [`guides/adding-a-module.md`](./guides/adding-a-module.md) | How to scaffold and remove an optional feature module |
| [`guides/perplexity-github-connector.md`](./guides/perplexity-github-connector.md) | Setting up and using the Perplexity → GitHub MCP connector |
| [`guides/perplexity-supabase-connector.md`](./guides/perplexity-supabase-connector.md) | Setting up and using the Perplexity → Supabase MCP connector |

## Playbook

| File | Purpose |
|---|---|
| [`playbook/lean-techstack.md`](./playbook/lean-techstack.md) | Rationale for the lean stack choices |
| [`playbook/mvp-dos-vs-donts.md`](./playbook/mvp-dos-vs-donts.md) | MVP scope rules and anti-patterns |

## Archive

Superseded or reference-only documents — do not treat as current.

| File | Purpose |
|---|---|
| [`archive/reference-only.md`](./archive/reference-only.md) | Historical reference material |
| [`archive/stage1-version-comparison.md`](./archive/stage1-version-comparison.md) | Stage 1 dependency version comparison (superseded) |

---

## Key Conventions

- **Canonical path:** `lib/` — never `src/lib/`
- **Canonical table names:** `profiles`, `subscriptions`, `webhook_events` — never aliased
- **This file** should be updated whenever a new doc is added to `docs/`
