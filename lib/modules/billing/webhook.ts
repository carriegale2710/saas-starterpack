/**
 * Stripe webhook event processing for the billing module.
 * 
 * This file contains the logic to process Stripe webhook events and update
 * the subscriptions table accordingly. It is used by the webhook route handler.
 * 
 * @see https://stripe.com/docs/webhooks
 */

import Stripe from 'stripe';
import { upsertSubscription, getSubscriptionByStripeId } from './queries';
import type { BillingEvent, SubscriptionStatus, Plan } from './types';

/**
 * Map Stripe subscription status to our internal status.
 * 
 * @see https://stripe.com/docs/api/subscriptions/object#subscription_object-status
 */
function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'incomplete':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    default:
      console.warn(`Unknown Stripe status: ${status}, defaulting to 'canceled'`);
      return 'canceled';
  }
}

/**
 * Map Stripe plan ID to our internal plan.
 * 
 * This should match your Stripe product/price configuration.
 * Update this to match your actual Stripe price IDs.
 */
function mapStripePriceToPlan(priceId: string): Plan {
  // Replace these with your actual Stripe price IDs
  const PRICE_MAP: Record<string, Plan> = {
    // 'price_1234567890': 'pro',
    // 'price_0987654321': 'enterprise',
  };
  
  return PRICE_MAP[priceId] ?? 'free';
}

/**
 * Parse a Stripe event into a billing event.
 * 
 * @param event - The Stripe webhook event
 * @returns The parsed billing event, or null if not a billing event
 */
function parseBillingEvent(event: Stripe.Event): BillingEvent | null {
  const subscription = event.data.object as Stripe.Subscription;
  
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return {
        type: event.type as BillingEvent['type'],
        subscriptionId: subscription.id,
        userId: subscription.metadata.user_id || '',
        status: mapStripeStatus(subscription.status),
        plan: mapStripePriceToPlan(subscription.items.data[0]?.price.id || ''),
        currentPeriodStart: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000)
          : undefined,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : undefined,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        type: 'checkout.session.completed',
        subscriptionId: session.subscription as string,
        userId: session.metadata?.user_id || '',
        status: 'active',
      };
    
    case 'invoice.paid':
      const invoice = event.data.object as Stripe.Invoice;
      return {
        type: 'invoice.paid',
        subscriptionId: invoice.subscription as string,
        userId: invoice.metadata?.user_id || '',
        status: 'active',
      };
    
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
      return {
        type: 'invoice.payment_failed',
        subscriptionId: failedInvoice.subscription as string,
        userId: failedInvoice.metadata?.user_id || '',
        status: 'past_due',
      };
    
    default:
      return null;
  }
}

/**
 * Process a Stripe webhook event and update the subscription.
 * 
 * This is the main entry point for webhook processing. It:
 * 1. Parses the Stripe event into a billing event
 * 2. Updates the subscription in the database
 * 3. Returns whether the event was processed successfully
 * 
 * @param event - The Stripe webhook event
 * @returns Whether the event was processed (true) or ignored (false)
 * 
 * @throws If there's an error updating the subscription
 */
export async function processStripeEvent(
  event: Stripe.Event
): Promise<boolean> {
  const billingEvent = parseBillingEvent(event);
  
  if (!billingEvent) {
    // Not a billing-related event, ignore it
    console.log(`Ignoring non-billing event: ${event.type}`);
    return false;
  }
  
  // Get existing subscription by Stripe ID if it exists
  const existingSubscription = await getSubscriptionByStripeId(
    billingEvent.subscriptionId
  );
  
  // Upsert the subscription with the new data
  await upsertSubscription({
    stripe_subscription_id: billingEvent.subscriptionId,
    user_id: billingEvent.userId,
    status: billingEvent.status,
    plan: billingEvent.plan,
    current_period_start: billingEvent.currentPeriodStart,
    current_period_end: billingEvent.currentPeriodEnd,
    cancel_at_period_end: billingEvent.cancelAtPeriodEnd ?? false,
  });
  
  console.log(
    `Processed billing event: ${billingEvent.type} for user ${billingEvent.userId}`
  );
  
  return true;
}
