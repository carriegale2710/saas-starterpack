# Guide: Optimising AI Agent Workflows

This guide defines in-scope guidance for keeping AI-agent work in this repository accurate, focused, and maintainable: file discovery, documentation ownership, concise edits, and verification.

> General programming tutorials, speculative architecture, product decisions, and detailed implementation rules belong in the relevant source-of-truth files, not here.

> Keep this guide short. If it starts accumulating implementation rules, move them to `CLAUDE.md`; if it accumulates rationale, move it to `docs/decisions.md`.

---

## File Structure Principles

- **Small, focused files.** Aim for ~50–150 lines per file. Agents reason better over small, self-contained units than large monoliths.
- **Predictable locations.** Agents infer intent from path. `lib/vendor/stripe/webhook.ts` is unambiguous; `utils/helpers.ts` is not. Rename vague files to reflect their domain.
- **Colocation.** Keep related logic, types, and tests close together. Less jumping around = less context lost.
- **No `src/` in this repo.** All logic is at the project root under `lib/`. Agents learn this from `AGENTS.md` — don’t create `src/` and split the map.

## Read in this order

1. `AGENTS.md` for orientation, commands, and navigation.
2. `CLAUDE.md` for Claude-specific implementation rules and constraints.
3. The source-of-truth document relevant to the task.
4. The code and tests that implement or verify the behaviour.

Do not assume a document is current merely because it exists. Check the relevant code, tests, and recent structure before changing a living document.

## Documentation ownership

| Topic                                      | Source of truth               | Link from                     |
| ------------------------------------------ | ----------------------------- | ----------------------------- |
| Agent orientation and commands             | `AGENTS.md`                   | Other agent instruction files |
| Implementation rules and constraints       | `CLAUDE.md`                   | Guides and task plans         |
| System behaviour and data flow             | `docs/architecture.md`        | Implementation docs           |
| Database schema and RLS                    | `docs/schema.md`              | Code and security docs        |
| Decision rationale, risks, pinned versions | `docs/decisions.md`           | Rules and plans               |
| Phase status and task checklist            | `docs/implementation-plan.md` | Task prompts                  |
| Agent prompt/workflow text                 | `docs/prompt-plan.md`         | Planning docs                 |
| Specific procedures                        | `docs/guides/*`               | Relevant task docs            |
| User setup and deployment                  | `README.md`                   | External/project docs         |
| User-facing release history                | `CHANGELOG.md`                | Release documentation         |

One topic should have one owner. Link to the owner instead of copying its explanation into another file.

---

## Core Documentation writing principles (most important!)

1. **Accurate beats complete.** Most important priciple to abide by. Accurate and discoverable documentation is more valuable than comprehensive documentation. Agents should make the smallest change that keeps the repository understandable and correct. Incorrect docs (stale comments, wrong examples) hurt agent output more than missing docs. Delete or update anything you know is wrong.
2. **Each file owns one concern. Point, don’t copy.** This repo’s docs are split up on purpose. Keep files in their scope. When one doc references something owned by another, link to it — don’t duplicate it. Duplication creates drift.
3. **Examples over descriptions. Avoid hard-coded values.** One real code snippet teaches an agent a pattern better than a paragraph of prose. See the patterns in `CLAUDE.md` as the model. However, keep example as generic syntax, don't use hardcoded values that might change over time to prevent inconsistencies.

## Anti-bloat rules

- Edit an existing section before creating a new one.
- Never append `Update`, `Notes`, `Recent changes`, or dated duplicates to a living document.
- Add content only when it records a durable rule, current behaviour, required procedure, or meaningful user-facing change.
- Do not document obvious code or repeat information already available from types, tests, or a linked source-of-truth file.
- Prefer a short rule and one representative example over a long explanation.
- Remove stale wording, repeated paragraphs, and obsolete examples as part of the same edit.
- Do not rewrite a whole file for a local change.
- Do not create a new guide unless the topic has a distinct owner and a repeatable audience.
- If a proposed addition makes a file substantially longer, first propose what to remove, merge, or extract.
- Ask before adding speculative guidance, future architecture, or policy that is not supported by the codebase.

## Scope boundaries

### In scope

- Keeping repository maps and navigation accurate.
- Recording implementation conventions that agents must follow.
- Maintaining links between documentation sources of truth.
- Explaining repeatable workflows with concise steps.
- Updating docs when code, tests, structure, or user-facing behaviour changes.
- Auditing documentation for duplication, stale claims, and unclear ownership.

### Out of scope

- General TypeScript, Next.js, Supabase, Stripe, or Git tutorials.
- Product strategy, feature proposals, and architectural alternatives without an accepted decision.
- Full copies of code or schema that are already maintained elsewhere.
- Per-task scratch notes, conversation transcripts, and progress diaries.
- Recording every refactor, test run, formatting change, or documentation edit in `CHANGELOG.md`.

## File and code patterns

- Use predictable, domain-specific paths. Keep application logic under root `lib/`; do not create `src/lib/`.
- Keep related logic, types, and tests close together.
- Avoid generic names such as `utils.ts`, `helpers.ts`, `data.ts`, `store.ts`, and `misc/`.
- Use explicit imports and exports. Avoid broad barrel exports that hide module boundaries.
- Prefer types and tests as executable documentation.
- Comment the reason or constraint, not the operation obvious from the code.
- Mark intentional skeletons so agents do not implement deferred work accidentally.

## Safe edit workflow

1. Identify the owning document and inspect the existing section.
2. Check the code, tests, and linked documents for the current truth.
3. Make the smallest targeted edit.
4. Replace or merge stale text instead of appending to it.
5. Check links, headings, examples, and terminology.
6. Update `CLAUDE.md`’s tree or test inventory when structure changes.
7. Update `CHANGELOG.md` only when the change meets its release-entry criteria.
8. Review the diff for unnecessary expansion and duplication.
9. Run the relevant tests or validation commands.

## Change-size heuristic

Use the lightest documentation response that preserves accuracy:

| Change                                                                   | Expected documentation action                                                          |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Internal implementation detail with no changed convention                | Usually no doc change                                                                  |
| New or changed implementation rule                                       | Update the owning rule document                                                        |
| New repeatable developer workflow                                        | Add or update a focused guide                                                          |
| File or directory added, moved, or deleted                               | Update the repository map                                                              |
| Test file or status changed                                              | Update the test inventory                                                              |
| User-facing feature, breaking change, security fix, or deployment change | Add one concise changelog entry                                                        |
| Temporary experiment or rejected option                                  | Keep it out of living docs; use `docs/archive/` only if it has lasting reference value |

## Final documentation check

Before completing a documentation edit, ask:

- Is this information in the correct file?
- Does another document already express it?
- Can a link replace this paragraph?
- Did I remove stale or repeated content?
- Is the example necessary and accurate?
- Is the change proportionate to the code change?
- Would a new agent know what to do without reading unrelated files?

For major changes, run a DRY audit with: `audit documentation for DRYness`.
