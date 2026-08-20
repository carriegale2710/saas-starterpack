# Perplexity Workflow — Skill Templates

> **Scope:** Reusable prompt templates for common coding tasks using Perplexity + GitHub MCP.  
> **Why this exists:** Claude Code auto-loads skill files on startup; Perplexity does not. These templates are manually invoked at the start of a task conversation.  
> **Related:** [`docs/guides/perplexity-github-connector.md`](./perplexity-github-connector.md) — connector setup, access levels, and safe coding workflow.

---

## How to Use

1. Copy the relevant template below.
2. Paste it as your **opening message** in a new Perplexity chat.
3. Fill in the bracketed placeholders before sending.
4. Follow the Verification Checklist before committing any change.

---

## Skill 1 — Code Quality Review

Use when reviewing a file, PR, or diff for quality, simplicity, and correctness.

```text
@GitHub Fetch CLAUDE.md from carriegale2710/saas-starterpack on main.

Review [FILE PATH or PR NUMBER] against the Lazy Senior Dev rules in CLAUDE.md:
- Flag anything a senior dev would simplify or delete
- No unrequested abstractions, no speculative scaffolding
- TypeScript strict — would npm run typecheck pass?
- No avoidable dependencies added
- Security constraints respected (RLS, service-role key, webhook boundary)

List issues by severity. Do not suggest rewrites unless a rule is clearly violated.
```

---

## Skill 2 — Feature Implementation

Use when implementing a new feature or task from an issue or plan.

```text
@GitHub Work in carriegale2710/saas-starterpack on branch [BRANCH NAME].

Task: [DESCRIBE THE FEATURE OR TASK]

1. Fetch and read the relevant files — do not edit anything yet
2. Fetch CLAUDE.md and identify the applicable constraints
3. Propose a minimal implementation plan: list only the files to change and why
4. Wait for my approval before writing any code
5. After implementing: confirm npm run validate would pass (lint + typecheck + tests)
6. Show the full diff before committing
7. Commit only after I confirm the diff is correct
```

---

## Skill 3 — New Component

Use when scaffolding a new UI component.

```text
@GitHub Work in carriegale2710/saas-starterpack on branch [BRANCH NAME].

Scaffold a new component: [COMPONENT NAME AND PURPOSE]

Rules:
- Check components/ui/ for existing primitives before creating anything new
- ShadCN + Tailwind only — no custom wrapper components
- Nav links go in lib/config.ts, never in the component file
- No new dependencies unless already installed
- Follow the naming and file conventions in CLAUDE.md

Show the proposed file contents before committing.
```

---

## Verification Checklist

Perplexity cannot run commands. Run these yourself locally before merging any change.

```bash
npm run typecheck   # TypeScript — zero errors required
npm run lint        # ESLint — zero errors required
npm run test        # Vitest — all tests pass
# Or run all three in one shot:
npm run validate
```

Additional checks:

- [ ] `npm run validate` passes with zero errors
- [ ] Only the intended files were changed (review the diff)
- [ ] No secrets, API keys, or credentials were introduced
- [ ] For UI changes: verified in browser or screenshot before marking done
- [ ] Tests cover the critical path — not every line, just the core behaviour
- [ ] `CLAUDE.md` repository tree updated if a new file or directory was added

---

## Tips

- **Always name the branch** in every coding request — Perplexity needs it to target the right ref.
- **Inspect before editing** — ask Perplexity to read and explain files before proposing changes.
- **One skill per conversation** — mixing tasks in a single chat increases context drift.
- **Treat output as a proposal** — review every diff before approving a commit.
- For the full safe coding workflow, see [`docs/guides/perplexity-github-connector.md` → Safe Coding Workflow](./perplexity-github-connector.md#safe-coding-workflow).
