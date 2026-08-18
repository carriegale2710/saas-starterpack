/**
 * Subscription entitlement logic.
 * Single source of truth for access decisions.
 * Reads past_due policy from lib/config.ts — never hard-code it here.
 */
import { BILLING_CONFIG } from '@/lib/config';
import type { SubscriptionStatus } from '@/lib/database.types';

type Subscription = { status: SubscriptionStatus } | null;

/**
 * Returns true if the subscription grants premium access.
 * - active and trialing: always yes
 * - past_due: controlled by BILLING_CONFIG.pastDueGracePeriod
 * - all other statuses (canceled, unpaid, incomplete, incomplete_expired): no
 * - null / missing: no
 */
export function hasActiveSubscription(subscription: Subscription): boolean {
  if (!subscription) return false;

  switch (subscription.status) {
    case 'active':
    case 'trialing':
      return true;
    case 'past_due':
      return BILLING_CONFIG.pastDueGracePeriod;
    default:
      return false;
  }
}

/**
 * Throws if the subscription does not grant access.
 * Use in Server Components and Server Actions to gate premium features.
 */
export function requireActiveSubscription(subscription: Subscription): void {
  if (!hasActiveSubscription(subscription)) {
    throw new Error('Subscription required');
  }
}
