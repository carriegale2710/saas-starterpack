/**
 * Stripe Customer Portal session helpers.
 * Server-only — never import in client components.
 */
import type Stripe from 'stripe';
import { getStripe } from './client';
import { APP_CONFIG } from '@/lib/config';

export interface CreatePortalSessionParams {
  stripeCustomerId: string;
}

/**
 * Create a Stripe Customer Portal session for managing
 * or cancelling a subscription.
 */
export async function createPortalSession(
  params: CreatePortalSessionParams
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: `${APP_CONFIG.url}/billing`,
  });

  return session;
}
