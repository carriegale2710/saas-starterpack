/**
 * Stripe Checkout session helpers.
 * Server-only — never import in client components.
 */
import type Stripe from 'stripe';
import { getStripe } from './client';
import { env } from '@/lib/env';
import { APP_CONFIG, BILLING_CONFIG } from '@/lib/config';

export interface CreateCheckoutSessionParams {
  userId: string;
  userEmail: string;
  priceId?: string;
}

/**
 * Create a Stripe Checkout session for a subscription.
 * Embeds user_id in session metadata so the webhook can
 * associate the Stripe customer with the correct Supabase user.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const priceId = params.priceId ?? env.STRIPE_PRICE_ID_PRO;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: params.userEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      user_id: params.userId,
    },
    success_url: `${APP_CONFIG.url}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_CONFIG.url}/pricing`,
    subscription_data: {
      metadata: {
        user_id: params.userId,
      },
      trial_period_days:
        (BILLING_CONFIG as { trialDays?: number }).trialDays ?? undefined,
    },
  });

  return session;
}
