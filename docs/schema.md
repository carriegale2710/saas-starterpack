# Database Schema

## Authoritative Schema Definition

This document defines the complete Supabase PostgreSQL schema for the core SaaS starter. The canonical migration lives at `supabase/migrations/0001_initial.sql` — this document and that file must stay in sync.

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

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

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
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

---

### `subscriptions`

Subscription state, synced from Stripe webhooks. **Source of truth** for billing status.

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

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);
-- Hot path: SELECT status, plan_id, current_period_end FROM subscriptions WHERE user_id = auth.uid()

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**RLS Policies:**

```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users may read their own subscription (for billing page display)
CREATE POLICY "Users can read own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- No authenticated-user write policies.
-- All writes come from the webhook handler using the service-role key.
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- required for stale-processing recovery
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX idx_webhook_events_updated_at ON webhook_events(updated_at);  -- for stale recovery

CREATE TRIGGER update_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**RLS Policies:**

```sql
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- No authenticated-user policies. Access is exclusively via the service-role key.
-- Adding an auth.uid() IS NULL policy would be incorrect and misleading.
```

---

## Atomic Webhook Processing

The webhook handler uses a three-step approach: insert-on-arrival (idempotent), claim, then process in a transaction.

```sql
-- Step 1: Insert on arrival (idempotency gate)
INSERT INTO webhook_events (stripe_event_id, event_type, status, payload)
VALUES ($1, $2, 'pending', $3)
ON CONFLICT (stripe_event_id) DO NOTHING;
-- If 0 rows inserted: duplicate — return 200 immediately.

-- Step 2: Claim (atomic, outside transaction)
UPDATE webhook_events
SET status = 'processing', attempts = attempts + 1
WHERE stripe_event_id = $1 AND status = 'pending'
RETURNING id;
-- If no row returned: already claimed — return 200 immediately.

-- Step 3: Process (inside transaction)
BEGIN;
  INSERT INTO subscriptions (...) VALUES (...)
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET ...;

  UPDATE webhook_events
  SET status = 'processed', processed_at = NOW()
  WHERE id = $event_row_id;
COMMIT;
-- On error: ROLLBACK — event stays 'processing' and is recovered by stale-reset.
```

**Stale-processing recovery** (run on a schedule or manually):

```sql
UPDATE webhook_events
SET status = 'pending', error_message = 'reset after stale processing'
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

---

## Entitlement-Controlling Events

Only these Stripe event types trigger a subscription upsert:

| Event | What it signals |
|---|---|
| `checkout.session.completed` | Initial subscription created |
| `customer.subscription.updated` | Plan change, renewal, status change |
| `customer.subscription.deleted` | Cancellation |
| `invoice.paid` | Successful payment — confirms `active` status |
| `invoice.payment_failed` | Failed payment — triggers `past_due` |

All other event types are logged and acknowledged (200) without a subscription upsert. Unknown types must never crash the handler.

---

## Entitlement Logic

Access policy is defined in `lib/config.ts` (`BILLING_CONFIG`). The **template default** is conservative:

| Status | Default Access |
|---|---|
| `active`, `trialing` | Full access |
| `past_due` | **No access** — override via `BILLING_CONFIG.pastDueGracePeriod = true` |
| `canceled`, `unpaid`, `incomplete`, `incomplete_expired` | No access |
| No subscription record | No access |

Any status not matched by `lib/entitlements.ts` denies access by default.

---

## RLS Expectations

The service-role key bypasses RLS unconditionally — this is a Supabase platform behaviour, not a policy.

| Table | Authenticated User Access | Service-Role Access |
|---|---|---|
| `profiles` | Read/write own row only | Full access (RLS bypassed) |
| `subscriptions` | Read own rows only | Full access (RLS bypassed) |
| `webhook_events` | **No access** (no policies) | Full access (RLS bypassed) |

---

## Constraints & Validation

```sql
ALTER TABLE subscriptions ADD CONSTRAINT chk_subscription_periods
  CHECK (current_period_end IS NULL OR current_period_start IS NULL
         OR current_period_end >= current_period_start);

ALTER TABLE subscriptions ADD CONSTRAINT chk_stripe_customer_id_not_empty
  CHECK (stripe_customer_id != '');
```

---

## Migration Strategy

### Initial Migration

`supabase/migrations/0001_initial.sql` contains all DDL from this document. Apply it with:

```bash
npx supabase db reset        # local
npx supabase db push         # linked remote project
```

### Adding Migrations

```bash
npx supabase migration new <description>
# Edit the generated file, then:
npx supabase db push
```

### Adding Optional Modules

`workspaces` and `usage-billing` are **not** schema-neutral — they add tables with foreign-key relationships to `profiles` or `subscriptions`. Review carefully before activating.

### Rollback

```bash
npx supabase db reset  # local only
```
