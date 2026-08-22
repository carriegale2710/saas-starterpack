/**
 * Stripe webhook parsing and event handling.
 * Server-only — never import in client components.
 *
 * Implements the atomic claim pattern:
 *   1. INSERT ... ON CONFLICT DO NOTHING to claim the event (idempotency)
 *   2. Update status to 'processing'
 *   3. Wrap subscription upsert + status update to 'processed' in one transaction
 *   4. On failure: set status to 'failed'; transaction rolls back
 */
import type Stripe from 'stripe';
import { getStripe } from './client';
import { env } from '@/lib/env';

/** The five Stripe events that control subscription entitlements. */
export const ENTITLEMENT_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

export type EntitlementEvent = (typeof ENTITLEMENT_EVENTS)[number];

/**
 * Verify and parse a raw Stripe webhook request.
 * Throws if the signature is invalid.
 */
export function parseWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
}

/**
 * Route a verified Stripe event to the appropriate handler.
 * Unknown event types are logged and ignored (return without error).
 *
 * The actual database work (claim, upsert, status update) is performed
 * by the route handler in app/api/stripe/webhook/route.ts using a
 * Supabase service-role client that bypasses RLS.
 */
export function isEntitlementEvent(
  eventType: string
): eventType is EntitlementEvent {
  return (ENTITLEMENT_EVENTS as readonly string[]).includes(eventType);
}
