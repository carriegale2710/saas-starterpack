# Toolchain Guide

> This file outlines the core AI techstack and workflow chosen to build this project.
> **Why this setup?** See [Decision #17 in `docs/decisions.md`](./decisions.md#17-ai-toolchain-perplexity-pro--claude-sonnet-5--github-mcp) for the full rationale and rejected alternatives.

## Current Setup

| Tool                                       | Role                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Perplexity Pro** (Claude Sonnet 5 model) | Research, architecture review, living-doc maintenance, per-stage workflow orchestration |
| **GitHub MCP connector**                   | Direct file commits, code implementation, repository management                         |
| **Supabase MCP connector**                 | Database introspection, schema verification, RLS validation                             |
| **Local tools**                            | Git, VS Code, Supabase CLI, Stripe CLI, Vitest, Playwright                              |

## Model Selection

In Perplexity Pro, select **Claude Sonnet 5** (or Sonnet 4.6 if unavailable).

- Claude is preferred over GPT/Gemini for this workflow because it reliably follows multi-step pre-read instructions (`CLAUDE.md` → `decisions.md` → act) without dropping constraints mid-session
- Sonnet 5 has a 1M token context window — large enough to hold all living docs simultaneously
- `CLAUDE.md` has no special auto-load behaviour; it is read via an explicit GitHub MCP tool call as instructed in `docs/prompt-plan.md` Per-Stage Workflow step 2

## Key Rules

- **Perplexity Pro** researches and decides — never ask it to write production code directly into the repo
- **GitHub MCP** writes code — never ask it to research external APIs or make architectural decisions
- Always start a GitHub MCP session by reading `CLAUDE.md` and `docs/decisions.md` before touching any file
- One focused task per session — context quality degrades with scope creep

## Session Startup Checklist

1. Open Perplexity Pro → select Claude Sonnet 5
2. Confirm the current stage in `docs/prompt-plan.md`
3. Run the Perplexity Pro research step for that stage
4. Switch to GitHub MCP → instruct it to read `CLAUDE.md` and `docs/decisions.md` first
5. Implement, then run the Stage Close Checklist before committing
