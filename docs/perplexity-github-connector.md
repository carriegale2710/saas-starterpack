# Perplexity + GitHub Cheatsheet

A quick guide to using Perplexity with the GitHub connector for repository research, coding tasks, reviews, and project maintenance.

## What It Does

The GitHub connector lets Perplexity search and work with connected repositories directly from chat. It can combine repository context with web research and, where supported, perform GitHub actions such as creating branches, updating files, and managing pull requests.

## Setup

1. Open **Settings → Connectors** in Perplexity.
2. Find **GitHub** and select **Enable**.
3. Sign in to GitHub.
4. Review the requested permissions and select **Authorize**.
5. In a chat, specify the repository and branch you want to use.

> For private repositories, confirm that the GitHub account connected to Perplexity has access to the repository.

## Start Every Request Clearly

Include:

- Repository: `owner/repository`
- Branch: `branch-name`
- Target files or directories
- Desired outcome
- Constraints, such as framework, style, or test requirements
- Whether to inspect, modify, commit, or create a pull request

### Good Prompt

```text
Work in carriegale2710/saas-starterpack on the perplexity branch.

Inspect the existing docs structure, then add a concise onboarding guide
under docs/. Match the repository's existing Markdown style. Do not modify
application code. Show me the proposed file before committing it.
```

## Safe Coding Workflow

### 1. Inspect Before Editing

```text
List the repository structure on the perplexity branch.
Identify the relevant files for the authentication flow.
Do not make changes yet.
```

Ask for:

- Relevant file contents
- Existing conventions
- Related tests
- Configuration and environment requirements
- Current branch and recent commits

### 2. Plan the Change

```text
Based on the repository, propose a minimal implementation plan.
List the files you would change and explain why.
Do not edit anything yet.
```

### 3. Implement Narrowly

```text
Implement the approved plan on the perplexity branch.
Change only the listed files.
Preserve existing APIs and conventions.
Add or update tests where appropriate.
```

### 4. Review the Diff

```text
Review the changes on the perplexity branch.
Check for bugs, regressions, security issues, missing tests,
unused code, and inconsistencies with the existing architecture.
Do not commit additional changes.
```

### 5. Commit or Open a PR

```text
If the diff is correct, commit it on the perplexity branch with
the message: "docs: add GitHub connector cheatsheet"
```

Or:

```text
Create a pull request from perplexity into main.
Use a concise summary, list the files changed, and include testing notes.
```

## High-Value Use Cases

| Use case               | Example request                                                           |
| ---------------------- | ------------------------------------------------------------------------- |
| Repository orientation | “Explain the architecture and identify the main entry points.”            |
| Code search            | “Find every place where user permissions are checked.”                    |
| Feature planning       | “Suggest the smallest safe change to add email verification.”             |
| Implementation         | “Add the feature using the existing service and validation patterns.”     |
| Bug investigation      | “Trace this error through the repository and identify likely causes.”     |
| Test creation          | “Find the existing test conventions and add coverage for this edge case.” |
| Code review            | “Review this branch for correctness, security, and maintainability.”      |
| CI debugging           | “Inspect the failing workflow and explain the likely failure.”            |
| Documentation          | “Update the relevant docs to match the current implementation.”           |
| Refactoring            | “Identify duplicated logic and propose a low-risk refactor.”              |
| PR management          | “Summarize open PRs and highlight ones with failing checks.”              |
| Issue triage           | “Group open issues by theme and suggest priorities.”                      |

## Prompt Patterns

### Understand Existing Code

```text
Explain [file/module] in the context of the rest of the repository.
Include its inputs, outputs, dependencies, and likely failure modes.
```

### Find an Implementation Pattern

```text
Find an existing example of [pattern] in this repository.
Explain how I should follow the same pattern for [new feature].
```

### Make a Minimal Change

```text
Implement only the smallest change needed to [goal].
Avoid unrelated refactors and preserve the public interface.
```

### Debug an Error

```text
Investigate this error using the repository and relevant recent commits:

[PASTE ERROR]

Trace the likely execution path, identify the root cause,
and propose a fix before editing anything.
```

### Review Security

```text
Review the proposed changes for authentication, authorization,
secrets exposure, injection risks, unsafe data handling, and logging issues.
```

## Advantages

- **Repository-aware answers:** Responses can use the actual codebase instead of pasted snippets.
- **Less context switching:** Research, code inspection, planning, and GitHub tasks happen in one conversation.
- **Faster onboarding:** Perplexity can explain unfamiliar architecture and locate relevant code.
- **Better implementation consistency:** Prompts can require reuse of existing patterns.
- **Current external research:** Web research can be combined with repository context for libraries, APIs, and technical decisions.
- **Repeatable workflows:** Standard prompts make feature work, reviews, and documentation easier to reproduce.
- **Useful for solo development:** It acts as a research assistant, coding partner, reviewer, and project-maintenance helper.

## Best Practices

- Name the repository and branch in every coding request.
- Inspect before modifying.
- Request a file-by-file plan for non-trivial changes.
- Keep changes narrow and avoid unnecessary refactors.
- Ask for a diff review before committing.
- Require tests or explicit confirmation when tests are unavailable.
- Use a separate working branch for changes.
- Ask Perplexity to preserve existing conventions.
- Treat generated code as a proposal that still needs review.
- Never paste secrets, API keys, tokens, or production credentials into chat.
- Review permissions granted to the connector and revoke access when no longer needed.
- Confirm destructive actions before executing them.

## Limitations

- Repository context may be incomplete or stale; ask for specific files when accuracy matters.
- Perplexity cannot replace running the application, tests, linters, or deployment checks.
- Generated changes may compile but still contain product, security, or edge-case errors.
- Large repositories require focused prompts rather than broad requests.
- Connector capabilities and available GitHub actions depend on account permissions and the current integration.

## Recommended Solo-Founder Workflow

1. Create a feature branch.
2. Ask Perplexity to inspect relevant code.
3. Request a minimal implementation plan.
4. Approve and implement the change.
5. Ask for a security and regression review.
6. Run tests, linting, and the application locally.
7. Ask Perplexity to draft or review the pull request.
8. Merge only after reviewing the final diff and checks.

## Quick Command Templates

```text
Inspect [repo] on [branch] and explain [area].
```

```text
Plan a minimal change for [feature]. Do not edit files.
```

```text
Implement the approved plan on [branch]. Change only [files].
```

```text
Review the current diff for bugs, security issues, and missing tests.
```

```text
Create a pull request from [branch] into [target branch].
```

## Access Levels

Configure access in two places:

1. **Perplexity:** Enable and authorize the GitHub connector.
2. **GitHub:** Grant the connected account access to the target repository.

### Perplexity Configuration

1. Open **Perplexity → Settings → Connectors**.
2. Enable **GitHub**.
3. Sign in with the GitHub account that owns or can access the repository.
4. Review the requested permissions before selecting **Authorize**.
5. If you use an organization account, an administrator may need to enable the connector first.

The connector operates through your personal GitHub connection. Responses from a shared Perplexity session may be visible to everyone who can access that session, so do not use shared sessions for sensitive repository information.

### GitHub Repository Access

For `carriegale2710/saas-starterpack`, the connected GitHub account must be able to access the private repository.

| Goal                                                   | Recommended GitHub access                                   |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| Read files, search code, inspect commits               | Repository read access                                      |
| Create branches or push file changes                   | Repository write access                                     |
| Create or update pull requests                         | Write access plus pull-request permissions                  |
| Review PRs and read CI results                         | Read access to pull requests and Actions                    |
| Merge pull requests                                    | Write access and permission to merge into the target branch |
| Manage issues                                          | Issues read/write access                                    |
| Modify GitHub Actions workflows                        | Workflow write access; use cautiously                       |
| Manage repository settings, collaborators, or deletion | Admin access; avoid unless absolutely necessary             |

For a private repository owned by a personal GitHub account, collaborators generally receive the ability to pull and push; use a GitHub organization if you need more granular collaborator roles.

### Recommended Setup

For normal Perplexity-assisted coding:

- GitHub repository: **Private**
- Connected account: Repository owner or trusted collaborator
- Repository access: Only the required repository
- Code contents: **Read and write**
- Repository metadata: **Read-only**
- Pull requests: **Read and write**
- Issues: **Read and write**, only if issue management is required
- Actions/workflows: **Read-only** by default
- Packages, Codespaces, webhooks, GPG keys, SSH keys, audit logs: **Do not enable unless specifically required**

GitHub fine-grained permissions support `read`, `write`, and, where available, `admin` levels; write access includes read access. Metadata is normally required as read-only repository information.

### Read-Only Research Setup

Use this when Perplexity should inspect the repository but never modify it:

- Repository access: Only `saas-starterpack`
- Contents: Read-only
- Metadata: Read-only
- Pull requests: Read-only
- Issues: Read-only, if issue analysis is needed
- Actions: Read-only, if CI investigation is needed
- Everything else: Disabled

Example:

```text
Inspect carriegale2710/saas-starterpack on the perplexity branch.
You have read-only access for this task. Explain the relevant files,
but do not create branches, edit files, commit, or open a pull request.
```

### Coding Setup

Use this when Perplexity should create branches and push changes:

- Repository access: Only `saas-starterpack`
- Contents: Read and write
- Metadata: Read-only
- Pull requests: Read and write
- Issues: Read and write, if required
- Actions: Read-only initially
- Workflows: Write only when explicitly needed

Example:

```text
Work only in carriegale2710/saas-starterpack on the perplexity branch.
You may read and update files and create commits on this branch.
Do not modify main, change repository settings, edit workflows,
or merge pull requests without asking first.
```

### Least-Privilege Rules

- Select **only the required repository**, not all repositories.
- Prefer **read-only** access for research and code review.
- Use **write** access only when you want changes pushed.
- Avoid **admin** access for routine coding.
- Keep `main` protected with branch rules and pull-request reviews.
- Ask for confirmation before commits, merges, deletions, or workflow changes.
- Revoke the connector or reduce permissions when the project is finished.
- Never store secrets, API keys, or production credentials in prompts or documentation.

Perplexity’s GitHub connector may request broad account-level permissions, including repository, workflow, package, webhook, and personal-data access; review the authorization screen carefully before approving it.

## Troubleshooting Permission Errors

### Connector Shows "Connected" but Can't Access Repos

The most common issue — the OAuth connection is active but Perplexity can't reach the repository.

**Fix:**

1. Go to **GitHub → Settings → Applications → Authorized OAuth Apps**
2. Find the Perplexity app and click it
3. Check that the correct repositories are listed under "Repository access"
4. If not, click **Configure** and explicitly add `saas-starterpack` under "Only select repositories"
5. Save, then start a **new Perplexity chat** and re-select the connector before sending a message

### Private Repo Not Found or Invisible

Perplexity defaults to public repo access only.

**Fix:**

- When authorizing on GitHub, choose **"Only select repositories"** and manually tick your private repos
- Do **not** rely on "All repositories" — it sometimes fails to propagate for private repos

### Commits or File Writes Failing

Write actions require explicit permissions.

**Fix:**

1. Go to **GitHub → Settings → Applications → Authorized OAuth Apps → Perplexity**
2. Confirm **Contents: Read and Write** is granted
3. Confirm **Pull requests: Read and Write** if PR creation is failing
4. If unchanged, revoke and re-authorize the app entirely

### Approval Buttons Missing / Commits Not Executing

A known intermittent Perplexity-side issue.

**Fix:**

1. Start a completely new chat
2. Re-select the GitHub connector before sending any messages
3. If still broken, disconnect the connector in Perplexity, revoke the OAuth app in GitHub, then reconnect from scratch
4. Try a different client (web → desktop → mobile) to force fresh tool initialization

### "Not Found" Error on Private Repo

Usually a token scope or repo access issue.

**Fix:**

- Confirm the GitHub account connected to Perplexity is the **owner** of `saas-starterpack`, or has been added as a collaborator with write access
- If using a PAT instead of OAuth, ensure it has `repo` (full control of private repositories) scope enabled — fine-grained tokens need **Contents: read and write** plus **Metadata: read** at minimum

### Connector Missing Entirely (Mobile)

Reported as a mobile-specific bug where the GitHub connector doesn't appear at all.

**Fix:** Use the web app at [perplexity.ai](https://perplexity.ai) to configure and authorize the connector first, then retry on mobile.

### Stale Connection / Token Expired

OAuth tokens and app authorizations can silently expire.

**Fix — Full Reset:**

1. Log out of both Perplexity and GitHub
2. Clear cookies and local storage for both sites
3. Log back in
4. Re-authorize from **Perplexity → Settings → Connectors → GitHub**
5. On the GitHub authorization screen, select **Only select repositories** and add your private repos explicitly

### Organization Repo Not Accessible

If `saas-starterpack` is under an org (not personal), an org admin must approve the OAuth app.

**Fix:**

- Ask the org admin to go to **GitHub Org → Settings → Third-party access → OAuth Apps** and approve Perplexity
- Or request the admin enable the connector from within Perplexity Enterprise settings

### Quick Diagnostic Checklist

| Check                                       | Where                                                           |
| ------------------------------------------- | --------------------------------------------------------------- |
| Connector status is "Connected"             | Perplexity → Settings → Connectors                              |
| Perplexity OAuth app is authorized          | GitHub → Settings → Applications → Authorized OAuth Apps        |
| Private repo is explicitly selected         | GitHub OAuth app → Repository access → Only select repositories |
| Contents read/write is granted              | GitHub OAuth app → Permissions                                  |
| Repo owner or collaborator access confirmed | GitHub → `saas-starterpack` → Settings → Collaborators          |
| No active GitHub outage                     | [githubstatus.com](https://www.githubstatus.com)                |
