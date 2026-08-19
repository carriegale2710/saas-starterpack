# Guide: Adding an Optional Module

Optional modules live in `lib/modules/<name>/`. They extend the starter without coupling to core. Follow this guide when building any feature outside the mandatory scope defined in `CLAUDE.md` Section 4.

---

## When to Use a Module

Use a module when the feature:

- Has its own database tables
- Can be removed without breaking core auth, billing, or dashboard
- Is not needed in every deployment of this starter

Examples from `CLAUDE.md`: email (Resend), analytics (PostHog), AI integrations, background jobs, storage, workspaces.

---

## Scaffold Structure

```text
lib/modules/<name>/
  index.ts        # Public API — exports init() and types
  client.ts       # Third-party SDK client (if needed)
  <name>.ts       # Core logic
  types.ts        # Module-specific TypeScript types
supabase/migrations/
  <timestamp>_<name>_init.sql
```

---

## Module Contract

Every module must export:

```typescript
// lib/modules/<name>/index.ts

export function init(): void {
  // validate env vars, set up SDK, or no-op if not configured
}

export type { YourModuleType };
```

---

## Step-by-Step

### 1. Create the directory

```bash
mkdir -p lib/modules/<name>
```

### 2. Add env vars (if needed)

`.env.example`:

```bash
# <Name> module
YOUR_MODULE_API_KEY=
```

`lib/env.ts` (add as optional — core must boot without it):

```typescript
YOUR_MODULE_API_KEY: z.string().min(1).optional(),
```

`tests/setup.ts` stub:

```typescript
process.env.YOUR_MODULE_API_KEY = 'test-key';
```

### 3. Scaffold `index.ts`

```typescript
import { env } from '@/lib/env';

export function init(): void {
  if (!env.YOUR_MODULE_API_KEY) {
    console.warn('<name> module disabled — YOUR_MODULE_API_KEY not set');
    return;
  }
  // initialise SDK
}

export type YourModuleType = {/* ... */};
```

### 4. Add a migration (if you need new tables)

```sql
-- supabase/migrations/<timestamp>_<name>_init.sql
CREATE TABLE IF NOT EXISTS <name>_table (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE <name>_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own rows"
  ON <name>_table FOR ALL
  USING (auth.uid() = user_id);
```

Then regenerate types:

```bash
npx supabase gen types typescript --project-id <project-ref> > lib/database.types.ts
```

### 5. Write tests

Create `tests/<name>.test.ts`. At minimum cover:

- `init()` with and without the API key set
- Core logic functions

### 6. Log the decision

Add an entry to `docs/decisions.md`:

```markdown
## Decision #N — Add <Name> Module

**Date:** YYYY-MM-DD
**Status:** Accepted
**Context:** ...
**Decision:** Use <library/service> because ...
**Consequences:** ...
```

---

## Removing a Module

1. Delete `lib/modules/<name>/`
2. Remove env vars from `lib/env.ts` and `.env.example`
3. Remove stubs from `tests/setup.ts`
4. Drop the module's tables in a new migration (never delete old migration files)
5. Update `docs/decisions.md` with a "Superseded" status note

---

## Rules

- Never import from `lib/modules/<name>/` inside `lib/vendor/` or core `lib/*.ts`
- Never modify `profiles`, `subscriptions`, or `webhook_events` from a module (workspaces/usage-billing are documented exceptions — see `docs/decisions.md`)
- Module env vars are always optional in the Zod schema — core must boot without them
