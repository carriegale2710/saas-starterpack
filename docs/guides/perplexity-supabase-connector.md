# Perplexity + Supabase Cheatsheet

A quick guide to using Perplexity with the Supabase connector for database introspection, schema verification, RLS validation, and migration review.

> For how this connector fits into the overall workflow, see [`docs/toolchain.md`](../toolchain.md).

## What It Does

The Supabase connector gives Perplexity read access to your live Supabase project — tables, schemas, migrations, extensions, RLS policies, edge functions, and logs — without needing to paste SQL or schema dumps into chat.

It does **not** write to the database. All DDL changes go through `apply_migration`; DML queries use `execute_sql`. Treat both as deliberate, reviewable actions — not automatic.

## Setup

1. Open **Settings → Connectors** in Perplexity.
2. Find **Supabase** and select **Enable**.
3. Sign in to your Supabase account and select **Authorize**.
4. Perplexity will list your organisations and projects automatically.

> The connector uses your Supabase account credentials. It can access all projects in your account — scope your requests to the correct project ID to avoid acting on the wrong database.

## Start Every Request Clearly

Include:

- Project name or ID (e.g. `saas-starterpack`)
- The schema or table you care about (`public`, `auth`, etc.)
- Whether you want to inspect only, or also run a query or migration
- Any constraints — "read-only", "do not modify", "show me the SQL before applying"

### Good Prompt

```text
Connect to the saas-starterpack Supabase project.

List all tables in the public schema with their RLS status.
Do not run any queries or apply any migrations yet.
```

## High-Value Use Cases

| Use case | Example request |
|---|---|
| Schema overview | "List all tables and their columns in the public schema." |
| RLS audit | "Check which tables are missing RLS policies." |
| Migration history | "Show all applied migrations in order." |
| Policy inspection | "Show the RLS policies on the `subscriptions` table." |
| Extension check | "List all enabled Postgres extensions." |
| Type generation | "Generate TypeScript types for the current schema." |
| Log investigation | "Show recent Edge Function errors from the last hour." |
| Pre-migration check | "Verify the current schema before I apply this migration." |
| Security advisor | "Run the security advisor and list any warnings." |

## Prompt Patterns

### Inspect Schema Before Migrating

```text
Show me the current columns and constraints on the [table] table.
I'm about to apply a migration that adds [column] — confirm there are no conflicts.
Do not apply anything yet.
```

### RLS Policy Review

```text
List all RLS policies on [table].
Identify any policy that could allow unintended access,
particularly for unauthenticated or service-role requests.
```

### Apply a Migration Safely

```text
Apply the following migration to the saas-starterpack project.
Name it [migration_name].
Show me the SQL and confirm the intent before applying.

[PASTE SQL]
```

### Investigate a Log Error

```text
Query the logs for the saas-starterpack project.
Filter for errors in edge_logs or postgres_logs in the last 2 hours.
Summarise the most frequent error types and their likely causes.
```

## Best Practices

- Always confirm the project ID before running queries or migrations — you cannot undo a `apply_migration` call.
- Use "inspect only, do not apply" in prompts when you just need to review.
- Never paste the Supabase service-role key or JWT secret into chat.
- Prefer `apply_migration` (tracked, named, reversible-by-convention) over raw `execute_sql` for schema changes.
- Run `get_advisors` (security + performance) after any DDL change.
- Keep migration names in snake_case and descriptive — they become part of the audit trail.

## Limitations

- The connector reads live production data — always be explicit about whether you want read-only or write access in a session.
- `execute_sql` can return user data; do not paste query results into other tools or share them outside the session.
- Log queries are capped at a 24-hour window.
- Edge Function deployments via the connector are live immediately — there is no staging step.

## Troubleshooting

### Project Not Listed

- Confirm the Supabase account authorized in Perplexity owns or has access to the project.
- Disconnect and re-authorize from **Perplexity → Settings → Connectors → Supabase**.

### Migration Fails to Apply

- Check that the SQL is valid Postgres — the connector passes it directly to the database.
- Confirm no conflicting migration has already been applied (`list_migrations`).
- Check for RLS or permission errors if the query touches protected tables.

### Logs Return No Results

- The log window defaults to the last 24 hours; pass explicit `iso_timestamp_start` and `iso_timestamp_end` if you need a specific range.
- Confirm the correct `source` value — run `SELECT DISTINCT source FROM logs` to discover available sources for the project.

### Quick Diagnostic Checklist

| Check | Where |
|---|---|
| Connector status is "Connected" | Perplexity → Settings → Connectors |
| Correct project selected | Confirm project ID matches `saas-starterpack` |
| No Supabase outage | [status.supabase.com](https://status.supabase.com) |
| Service-role key not exposed | Check that no prompt or doc contains the key |
