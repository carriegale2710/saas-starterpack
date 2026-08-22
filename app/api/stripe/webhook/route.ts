/**
 * POST /api/stripe/webhook
 *
 * Receives and processes Stripe webhook events.
 *
 * Security:     Signature verified with STRIPE_WEBHOOK_SECRET.
 * Idempotency:  Atomic claim pattern — INSERT ON CONFLICT DO NOTHING.
 * Retry-safe:   Events already processed return 200 immediately.
 *
 * Handled events (ENTITLEMENT_EVENTS):
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.paid
 *   invoice.payment_failed
 *
 * All other events are acknowledged (200) without processing.
 */
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { parseWebhookEvent, isEntitlementEvent } from '@/lib/vendor/stripe/webhook';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Disable body parsing — we need the raw buffer for Stripe signature verification.
export const config = {
  api: { bodyParser: false },
};

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const rawBody = await request.text();

  // ── 1. Verify signature ────────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = parseWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── 2. Atomic claim — INSERT ON CONFLICT DO NOTHING ───────────────────────
  // If this event_id was already processed we get 0 rows inserted → early exit.
  const { count: claimed, error: claimError } = await admin
    .from('webhook_events')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      status: 'pending',
    })
    .select('id', { count: 'exact', head: true })
    .throwOnError();

  if (claimError) {
    // Unique constraint violation → already processed
    console.log('[webhook] Duplicate event, skipping:', event.id);
    return NextResponse.json({ received: true });
  }

  if (claimed === 0) {
    console.log('[webhook] Already claimed, skipping:', event.id);
    return NextResponse.json({ received: true });
  }

  // ── 3. Mark as processing ─────────────────────────────────────────────────
  await admin
    .from('webhook_events')
    .update({ status: 'processing' })
    .eq('stripe_event_id', event.id);

  // ── 4. Handle entitlement events ──────────────────────────────────────────
  if (!isEntitlementEvent(event.type)) {
    await admin
      .from('webhook_events')
      .update({ status: 'processed' })
      .eq('stripe_event_id', event.id);
    return NextResponse.json({ received: true });
  }

  try {
    await handleEntitlementEvent(event, admin);

    await admin
      .from('webhook_events')
      .update({ status: 'processed' })
      .eq('stripe_event_id', event.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[webhook] Handler error:', message);
    await admin
      .from('webhook_events')
      .update({ status: 'failed', error: message })
      .eq('stripe_event_id', event.id);
    // Return 500 so Stripe retries
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ── Entitlement handler ──────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>;

async function handleEntitlementEvent(
  event: Stripe.Event,
  admin: AdminClient
): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertSubscription(subscription, admin);
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        // Fetch the full subscription object to get accurate status
        const { getStripe } = await import('@/lib/vendor/stripe/client');
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id
        );
        await upsertSubscription(sub, admin);
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const { getStripe } = await import('@/lib/vendor/stripe/client');
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id
        );
        await upsertSubscription(sub, admin);
      }
      break;
    }
    default:
      console.warn('[webhook] Unhandled entitlement event:', event.type);
  }
}

/**
 * Upsert a subscription row.
 * The user_id is read from subscription.metadata.user_id — set during checkout.
 * On conflict (same stripe_subscription_id) the row is updated in place.
 */
async function upsertSubscription(
  subscription: Stripe.Subscription,
  admin: AdminClient
): Promise<void> {
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    throw new Error(
      `[webhook] subscription ${subscription.id} is missing metadata.user_id`
    );
  }

  const priceId =
    subscription.items.data[0]?.price?.id ?? null;

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      stripe_price_id: priceId,
      status: subscription.status as import('@/lib/database.types').Database['public']['Enums']['subscription_status'],
      current_period_start: new Date(
        subscription.current_period_start * 1000
      ).toISOString(),
      current_period_end: new Date(
        subscription.current_period_end * 1000
      ).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(`[webhook] upsertSubscription DB error: ${error.message}`);
  }
}
