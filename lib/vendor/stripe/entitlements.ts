/**
 * Subscription entitlement helpers.
 * Server-only — never import in client components.
 *
 * Entitlement policy (from BILLING_CONFIG):
 *   active, trialing       → premium access
 *   past_due               → no access (unless BILLING_CONFIG.pastDueGracePeriod is true)
 *   canceled, unpaid,
 *   incomplete,
 *   incomplete_expired     → no access
 *   missing / unknown      → deny by default
 */
import { redirect } from 'next/navigation';
import { BILLING_CONFIG } from '@/lib/config';
import type { SubscriptionStatus } from '@/lib/database.types';
import { createAdminClient } from '@/lib/supabase/admin';

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch the subscription row for a user.
 * Returns null if no subscription exists.
 */
export async function getCurrentSubscription(
  userId: string
): Promise<SubscriptionRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[entitlements] getCurrentSubscription error:', error.message);
    return null;
  }
  return data;
}

/**
 * Returns true only when the user has an active or trialing subscription.
 * Respects BILLING_CONFIG.pastDueGracePeriod for past_due handling.
 */
export function hasActiveSubscription(
  subscription: SubscriptionRecord | null
): boolean {
  if (!subscription) return false;

  const { status } = subscription;

  if (status === 'active' || status === 'trialing') return true;

  if (status === 'past_due' && BILLING_CONFIG.pastDueGracePeriod) return true;

  return false;
}

/**
 * Server-side guard: redirects to /pricing if the user has no active subscription.
 * Call at the top of any server component or route handler requiring premium access.
 */
export async function requireActiveSubscription(userId: string): Promise<void> {
  const subscription = await getCurrentSubscription(userId);
  if (!hasActiveSubscription(subscription)) {
    redirect('/pricing');
  }
}
