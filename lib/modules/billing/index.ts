/**
 * Billing module public interface
 * 
 * This is the only file you should import from when using the billing module.
 * All other files are internal implementation details.
 * 
 * @example
 * ```typescript
 * import { canAccessFeature, getSubscription } from '@/lib/modules/billing';
 * 
 * const hasAccess = await canAccessFeature(userId, 'advanced_analytics');
 * ```
 */

// Types
export type {
  Subscription,
  SubscriptionStatus,
  Plan,
  EntitlementResult,
  BillingEventType,
  BillingEvent,
} from './types';

// Entitlement checks
export {
  canAccessFeature,
  getSubscription,
  getSubscriptionStatus,
  checkFeatures,
  getAvailableFeatures,
  type Feature,
} from './entitlements';

// Webhook processing
export {
  processStripeEvent,
} from './webhook';
