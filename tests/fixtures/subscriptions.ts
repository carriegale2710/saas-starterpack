/**
 * Typed subscription fixtures for all possible statuses.
 * Use these in tests instead of inline object literals.
 *
 * NOTE: The canonical status list is the `subscription_status` enum in
 * supabase/migrations/0001_initial.sql and lib/database.types.ts.
 * Do not add statuses here that are not in the DB enum — TypeScript will
 * catch the mismatch at typecheck time.
 *
 * Stripe does expose a `paused` status but it is not in our schema enum
 * because the project does not use Stripe's pause_collection feature.
 * If you add it to the migration, regenerate lib/database.types.ts and
 * add it back here.
 */
import type { SubscriptionStatus } from '@/lib/database.types';

export interface MockSubscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: SubscriptionStatus;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

const base: MockSubscription = {
  id: 'sub-fixture-1',
  user_id: 'user-fixture-1',
  stripe_customer_id: 'cus_test123',
  stripe_subscription_id: 'sub_test123',
  stripe_price_id: 'price_test123',
  status: 'active',
  current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancel_at_period_end: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const subscriptionFixtures: Record<SubscriptionStatus, MockSubscription> = {
  active: { ...base, status: 'active' },
  trialing: { ...base, status: 'trialing' },
  past_due: { ...base, status: 'past_due' },
  canceled: { ...base, status: 'canceled', current_period_end: new Date(Date.now() - 1000).toISOString() },
  unpaid: { ...base, status: 'unpaid' },
  incomplete: { ...base, status: 'incomplete' },
  incomplete_expired: { ...base, status: 'incomplete_expired' },
};
