/**
 * Stripe server client.
 * Server-only — never import this in browser/client components.
 * Initialised once from the validated env object.
 */
import Stripe from 'stripe';
import { env } from '@/lib/env';

// Module-level singleton — reuse across requests in the same server process.
// Safe in production. In Next.js dev mode, Fast Refresh can invalidate the
// module without restarting the process; _stripe may be recreated on the next
// call. This is harmless because Stripe SDK instances are stateless.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return _stripe;
}
