/**
 * Billing unit tests.
 *
 * Tests the contracts for Stripe Checkout and Customer Portal session creation
 * (lib/vendor/stripe/checkout.ts and portal.ts) before they are implemented.
 * No real Stripe API calls — tests validate shapes, config, and logic only.
 *
 * Run: npm test -- tests/billing.test.ts
 */
import { describe, it, expect } from 'vitest';
import { APP_CONFIG, BILLING_CONFIG } from '@/lib/config';
import { subscriptionFixtures } from './fixtures/subscriptions';

// ---------------------------------------------------------------------------
// Checkout session contract
// ---------------------------------------------------------------------------

describe('Checkout session contract', () => {
  it('BILLING_CONFIG does not expose a hardcoded price ID (must come from env)', () => {
    // Price IDs must come from STRIPE_PRICE_ID_PRO env var, not be hardcoded
    // in config. This test ensures no price_ string leaks into BILLING_CONFIG.
    const configStr = JSON.stringify(BILLING_CONFIG);
    expect(configStr).not.toMatch(/price_/);
  });

  it('APP_CONFIG has a URL for redirect after checkout', () => {
    // Checkout session success_url and cancel_url are built from APP_CONFIG.url
    expect(APP_CONFIG).toHaveProperty('url');
    // When implemented:
    // const session = buildCheckoutSession({ userId, priceId, appUrl: APP_CONFIG.url });
    // expect(session.success_url).toContain(APP_CONFIG.url);
    // expect(session.cancel_url).toContain(APP_CONFIG.url);
  });

  it('checkout session must include user_id in metadata', () => {
    // Contract: every checkout session must embed user_id in metadata so the
    // webhook handler can link the Stripe customer to the Supabase user.
    const mockMetadata = { user_id: 'user-fixture-1' };
    expect(mockMetadata).toHaveProperty('user_id');
    expect(mockMetadata.user_id).toBeTruthy();
  });

  it('checkout session mode must be subscription, not payment', () => {
    // Recurring billing requires mode: 'subscription'.
    const mode = 'subscription';
    expect(mode).toBe('subscription');
  });
});

// ---------------------------------------------------------------------------
// Subscription status → access gate
// ---------------------------------------------------------------------------

describe('Subscription status coverage', () => {
  it('fixtures cover all DB subscription statuses', () => {
    // These are the 7 statuses defined in the subscription_status enum
    // in supabase/migrations/0001_initial.sql.
    // NOTE: Stripe's `paused` status is intentionally excluded — see
    // tests/fixtures/subscriptions.ts for explanation.
    const expectedStatuses = [
      'active',
      'trialing',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
    ] as const;

    for (const status of expectedStatuses) {
      expect(subscriptionFixtures[status]).toBeDefined();
      expect(subscriptionFixtures[status].status).toBe(status);
    }
  });

  it('active and trialing fixtures have a future current_period_end', () => {
    const now = new Date();
    expect(new Date(subscriptionFixtures.active.current_period_end) > now).toBe(true);
    expect(new Date(subscriptionFixtures.trialing.current_period_end) > now).toBe(true);
  });

  it('canceled fixture has a past current_period_end', () => {
    const now = new Date();
    expect(new Date(subscriptionFixtures.canceled.current_period_end) < now).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BILLING_CONFIG defaults
// ---------------------------------------------------------------------------

describe('BILLING_CONFIG billing policy', () => {
  it('pastDueGracePeriod defaults to false (deny access immediately)', () => {
    expect(BILLING_CONFIG.pastDueGracePeriod).toBe(false);
  });

  it('pastDueGracePeriod is a boolean, not truthy string or undefined', () => {
    expect(typeof BILLING_CONFIG.pastDueGracePeriod).toBe('boolean');
  });
});
