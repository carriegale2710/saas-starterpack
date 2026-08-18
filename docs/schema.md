# Database Schema

## Authoritative Schema Definition

This document defines the complete Supabase PostgreSQL schema for the core SaaS starter. All migrations, RLS policies, and indexes are specified here.

---

## Core Tables

### `profiles`

User profile data, synced from Supabase Auth on signup.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**RLS Policies:**

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

---

### `subscriptions`

Subscription state, synced from Stripe webhooks. This is the **source of truth** for billing status.

```sql
CREATE TYPE subscription_status AS ENUM (
  'active',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'trialing'
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status subscription_status NOT NULL DEFAULT 'incomplete',
  plan_id TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- Triggers for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**RLS Policies:**

```sql
-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY "Users can read own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can update subscriptions (via webhooks)
-- No user-facing write policies
```

---

### `webhook_events`

Atomic webhook event log for idempotent processing.

```sql
CREATE TYPE webhook_event_status AS ENUM (
  'pending',
  'processing',
  'processed',
  'failed'
);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  status webhook_event_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);

-- Constraint: prevent concurrent processing
CREATE UNIQUE INDEX idx_webhook_events_pending_unique
  ON webhook_events(stripe_event_id)
  WHERE status = 'pending';
```

**RLS Policies:**

```sql
-- Enable RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- No user access; service role only
CREATE POLICY "Service role can manage webhook events"
  ON webhook_events FOR ALL
  USING (auth.uid() IS NULL);  -- Service role bypass
```

---

## Constraints & Validation

### Foreign Key Constraints

- `profiles.id` → `auth.users.id` (CASCADE DELETE)
- `subscriptions.user_id` → `profiles.id` (CASCADE DELETE)

### Unique Constraints

- `profiles.email` — one account per email
- `subscriptions.stripe_customer_id` — one Stripe customer per user
- `subscriptions.stripe_subscription_id` — one record per subscription
- `webhook_events.stripe_event_id` — idempotent event processing

### Check Constraints

```sql
-- Ensure subscription periods are logical
ALTER TABLE subscriptions ADD CONSTRAINT chk_subscription_periods
  CHECK (current_period_end IS NULL OR current_period_start IS NULL
         OR current_period_end >= current_period_start);

-- Ensure Stripe IDs are non-empty
ALTER TABLE subscriptions ADD CONSTRAINT chk_stripe_customer_id_not_empty
  CHECK (stripe_customer_id != '');
```

---

## Timestamps

All tables use `TIMESTAMPTZ` (timezone-aware) for consistency:

| Column                 | Purpose                                |
| ---------------------- | -------------------------------------- |
| `created_at`           | Record creation time (default `NOW()`) |
| `updated_at`           | Last update time (trigger-managed)     |
| `processed_at`         | Webhook processing completion time     |
| `canceled_at`          | Subscription cancellation time         |
| `current_period_start` | Stripe billing period start            |
| `current_period_end`   | Stripe billing period end              |

---

## Entitlement Logic

Subscription status determines feature access:

| Status                                                   | Access Level                               |
| -------------------------------------------------------- | ------------------------------------------ |
| `active`, `trialing`                                     | Full access                                |
| `past_due`                                               | Grace period (read-only or limited access) |
| `canceled`, `unpaid`, `incomplete`, `incomplete_expired` | No access                                  |

**Unknown-status handling:**

If `subscriptions` table has no record for a user, treat as `status = NULL` → **no access** (deny by default).

---

## Migration Strategy

### Initial Migration

```bash
# Run via Supabase CLI
npx supabase db push
```

### Seed Data

```sql
-- No seed data required; all tables are user-generated
```

### Rollback

```bash
# Reset to migration 0
npx supabase db reset
```

---

## RLS Expectations

| Table            | User Access        | Service Role Access |
| ---------------- | ------------------ | ------------------- |
| `profiles`       | Read/write own row | Full access         |
| `subscriptions`  | Read own rows      | Full access         |
| `webhook_events` | No access          | Full access         |

**Security Model:**

- Users can only access their own data
- Service role (webhooks) bypasses RLS
- No cross-user data leakage possible
- Deny-by-default for unknown states

---

## Performance Considerations

### Indexes

All foreign keys and frequently queried columns are indexed:

- `profiles.email` — login lookups
- `subscriptions.user_id` — entitlement checks
- `subscriptions.stripe_customer_id` — webhook resolution
- `webhook_events.stripe_event_id` — idempotency checks

### Query Patterns

```sql
-- Get user's subscription status (entitlement check)
SELECT status, plan_id, current_period_end
FROM subscriptions
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;

-- Claim webhook event atomically
UPDATE webhook_events
SET status = 'processing', attempts = attempts + 1
WHERE stripe_event_id = $1 AND status = 'pending'
RETURNING id;
```

---

## Schema Evolution

### Adding Optional Modules

Each optional module adds its own tables without modifying core:

```sql
-- Example: workspaces module
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  ...
);
```

### Versioning

Schema changes are versioned via Supabase migrations:

```bash
npx supabase migration new add_workspaces_table
```

---

## Next Steps

1. Review schema for completeness
2. Approve or request changes
3. Generate migration files
4. Test RLS policies with multiple users
