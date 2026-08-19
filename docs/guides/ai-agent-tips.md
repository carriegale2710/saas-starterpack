# Guide: Optimising for AI Agent Workflows

Tips for keeping this codebase easy for AI coding agents (Cursor, Claude Code, Copilot, etc.) to understand and work with effectively.

---

## File Structure Principles

- **Small, focused files.** Aim for ~50–150 lines per file. Agents reason better over small, self-contained units than large monoliths.
- **Predictable locations.** Agents infer intent from path. `lib/vendor/stripe/webhook.ts` is unambiguous; `utils/helpers.ts` is not. Rename vague files to reflect their domain.
- **Colocation.** Keep related logic, types, and tests close together. Less jumping around = less context lost.
- **No `src/` in this repo.** All logic is at the project root under `lib/`. Agents learn this from `AGENTS.md` — don’t create `src/` and split the map.

---

## Documentation Principles

- **Accurate beats complete.** Incorrect docs (stale comments, wrong examples) hurt agent output more than missing docs. Delete or update anything you know is wrong.
- **Examples over descriptions.** One real code snippet teaches an agent a pattern better than a paragraph of prose. See the patterns in `CLAUDE.md` as the model.
- **Each file owns one concern.** This repo’s docs split is:
  - `AGENTS.md` — orientation map for any agent
  - `CLAUDE.md` — all implementation rules and patterns
  - `docs/architecture.md` — what happens (data flow)
  - `docs/decisions.md` — why it was decided that way
  - `docs/schema.md` — database structure
  - Never let two files contradict each other.
- **Point, don’t copy.** When one doc references something owned by another, link to it — don’t duplicate it. Duplication creates drift.

---

## Agent Instruction Files

| File | Read by | Purpose |
|---|---|---|
| `AGENTS.md` | All agents | Short orientation: stack, commands, directory map, where-to-find-things |
| `CLAUDE.md` | Claude Code | Full implementation rules, security patterns, scope boundaries |
| `.cursorrules` | Cursor | Add if you use Cursor — can be a short pointer to `AGENTS.md` |

**Keeping them healthy:**
- Update `AGENTS.md` directory map when files/folders are added or moved
- Update `CLAUDE.md` Section 1 tree and test table when structure changes
- Never let `AGENTS.md` and `CLAUDE.md` contradict each other — `CLAUDE.md` wins on implementation detail

---

## Naming Conventions

| Avoid | Prefer |
|---|---|
| `utils.ts`, `helpers.ts` | `subscriptionUtils.ts`, `authHelpers.ts` |
| `data.ts`, `store.ts` | `userSessionStore.ts`, `billingData.ts` |
| `index.ts` for logic | `index.ts` for public API of a module only |
| Generic folder `misc/` | Split into domain folders |

Agents copy naming patterns they see. Consistent, descriptive names reduce hallucinated file paths.

---

## Comments and Types

- **TypeScript types are free documentation.** Explicit return types, named interfaces, and union types tell agents exactly what a function produces — better than any comment.
- **Comment the *why*, not the *what*.** Agents can read code; they can’t read your intent. `// idempotency check — Stripe may send the same event twice` is useful. `// update the status` is not.
- **Mark intentional skeletons.** Skeleton files (`webhook.test.ts`, `billing.test.ts`) have a comment at the top explaining they activate in Phase 2. Without it, agents will try to fill them in.

---

## What to Avoid

- **Stale docs.** A wrong `CLAUDE.md` rule or outdated directory tree actively misleads agents. Run a quick review when a major refactor happens.
- **Over-documenting.** Docs you won’t maintain become liabilities. If it’s obvious from the code or types, skip the comment.
- **Barrel exports (`export * from ...`).** They obscure what’s available and make agent suggestions less precise. Prefer explicit named imports.
- **Magic patterns.** Dynamic imports, runtime codegen, and implicit config make behaviour hard to predict for agents and humans alike.
