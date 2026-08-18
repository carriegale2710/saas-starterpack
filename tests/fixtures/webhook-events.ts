/**
 * Minimal Stripe event payload fixtures for all 5 entitlement-controlling events.
 * These are plain objects — no Stripe SDK dependency required.
 * Shape matches what stripe.webhooks.constructEvent() returns.
 */

const baseSubscriptionObject = {
  id: 'sub_test123',
  object: 'subscription',
  customer: 'cus_test123',
  status: 'active',
  items: {
    data: [{ price: { id: 'price_test123' } }],
  },
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  cancel_at_period_end: false,
  metadata: { user_id: 'user-fixture-1' },
};

const baseEvent = {
  id: 'evt_test123',
  object: 'event',
  api_version: '2024-06-20',
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
};

export const webhookEventFixtures = {
  'checkout.session.completed': {
    ...baseEvent,
    id: 'evt_checkout_completed',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test123',
        object: 'checkout.session',
        customer: 'cus_test123',
        subscription: 'sub_test123',
        mode: 'subscription',
        payment_status: 'paid',
        metadata: { user_id: 'user-fixture-1' },
      },
    },
  },

  'customer.subscription.updated': {
    ...baseEvent,
    id: 'evt_sub_updated',
    type: 'customer.subscription.updated',
    data: { object: { ...baseSubscriptionObject, status: 'active' } },
  },

  'customer.subscription.deleted': {
    ...baseEvent,
    id: 'evt_sub_deleted',
    type: 'customer.subscription.deleted',
    data: { object: { ...baseSubscriptionObject, status: 'canceled' } },
  },

  'invoice.paid': {
    ...baseEvent,
    id: 'evt_invoice_paid',
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_test123',
        object: 'invoice',
        customer: 'cus_test123',
        subscription: 'sub_test123',
        status: 'paid',
        paid: true,
      },
    },
  },

  'invoice.payment_failed': {
    ...baseEvent,
    id: 'evt_invoice_failed',
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_test456',
        object: 'invoice',
        customer: 'cus_test123',
        subscription: 'sub_test123',
        status: 'open',
        paid: false,
      },
    },
  },
};

/** Events that must NOT trigger a subscription upsert. */
export const ignoredEventFixtures = {
  'customer.created': {
    ...baseEvent,
    id: 'evt_customer_created',
    type: 'customer.created',
    data: { object: { id: 'cus_test123', object: 'customer' } },
  },
  'payment_intent.succeeded': {
    ...baseEvent,
    id: 'evt_pi_succeeded',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test123', object: 'payment_intent', status: 'succeeded' } },
  },
};
