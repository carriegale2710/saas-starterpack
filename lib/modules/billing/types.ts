/**
 * Billing module domain types
 * 
 * These types define the subscription domain for the SaaS starter.
 * They are used by the billing module's public interface.
 */

/**
 * Subscription status values that control entitlement access.
 * 
 * Based on Stripe subscription statuses, mapped to our entitlement model.
 * See: docs/schema.md for full status table and entitlement implications.
 */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

/**
 * Plan tier definitions.
 * 
 * These match the plan definitions in lib/config.ts BILLING_CONFIG.plans.
 */
export type Plan = 'free' | 'pro' | 'enterprise';

/**
 * Subscription record as stored in Supabase subscriptions table.
 * 
 * This is a simplified view - the actual Supabase type may have more fields.
 * We only expose what the billing interface needs.
 */
export interface Subscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  plan: Plan;
  current_period_start?: Date;
  current_period_end?: Date;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Result of an entitlement check.
 */
export interface EntitlementResult {
  hasAccess: boolean;
  reason?: string;
}

/**
 * Stripe webhook event types that affect subscription state.
 * 
 * Canonical list from docs/decisions.md#3:
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 */
export type BillingEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed';

/**
 * Parsed billing event from Stripe webhook.
 */
export interface BillingEvent {
  type: BillingEventType;
  subscriptionId: string;
  userId: string;
  status?: SubscriptionStatus;
  plan?: Plan;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}
