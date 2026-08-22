/**
 * POST /api/stripe/webhook — unit tests.
 *
 * Boundary: NextRequest-level — handler is imported and called directly with
 * a manually constructed NextRequest. This exercises the body-parsing and
 * header-extraction paths without a full HTTP stack.
 *
 * Mock seam: vi.mock('@/lib/vendor/stripe/client') stubs getStripe() so the
 * singleton cache is bypassed and we control all Stripe SDK calls.
 * vi.mock('@/lib/supabase/admin') stubs createAdminClient().
 *
 * Run: npm test -- tests/webhook.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks (must be hoisted before the handler import) ───────────────────────

const mockStripeSubscriptionsRetrieve = vi.fn();
const mockGetStripe = vi.fn(() => ({
  subscriptions: { retrieve: mockStripeSubscriptionsRetrieve },
}));
vi.mock('@/lib/vendor/stripe/client', () => ({ getStripe: mockGetStripe }));

const mockParseWebhookEvent = vi.fn();
vi.mock('@/lib/vendor/stripe/webhook', () => ({
  parseWebhookEvent: mockParseWebhookEvent,
  isEntitlementEvent: (type: string) =>
    [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed',
    ].includes(type),
}));

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockAdminFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  upsert: mockUpsert,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
}));

// ── Import handler after mocks ───────────────────────────────────────────────
import { POST } from '@/app/api/stripe/webhook/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body = '{}', sig?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sig) headers['stripe-signature'] = sig;
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_test_123',
    customer: 'cus_test_123',
    status: 'active',
    cancel_at_period_end: false,
    current_period_start: Math.floor(Date.now() / 1000) - 86400,
    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 29,
    items: { data: [{ price: { id: 'price_placeholder' } }] },
    metadata: { user_id: 'user-fixture-1' },
    ...overrides,
  };
}

function makeEvent(type: string, object: unknown, id = 'evt_test_new') {
  return { id, type, data: { object } };
}

// Chain helpers — each builder returns itself so we can chain .select() etc.
function successClaim() {
  return {
    select: vi.fn().mockReturnValue({ count: 1, error: null }),
  };
}
function duplicateClaim() {
  return {
    select: vi.fn().mockReturnValue({ count: 0, error: { code: '23505' } }),
  };
}
function dbErrorClaim(message = 'connection refused') {
  return {
    select: vi.fn().mockReturnValue({ count: null, error: { code: '08006', message } }),
  };
}
function updateOk() {
  return { eq: vi.fn().mockReturnValue({ error: null }) };
}
function upsertOk() {
  return { error: null };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: update always succeeds
  mockUpdate.mockReturnValue(updateOk());
  // Default: upsert always succeeds
  mockUpsert.mockReturnValue(Promise.resolve(upsertOk()));
});

describe('POST /api/stripe/webhook — request validation', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await POST(makeRequest('{}', undefined));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/stripe-signature/i);
  });

  it('returns 400 when signature verification fails', async () => {
    mockParseWebhookEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const res = await POST(makeRequest('{}', 'bad-sig'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
  });
});

describe('POST /api/stripe/webhook — idempotency', () => {
  it('returns 200 immediately for a duplicate event (23505 code path)', async () => {
    const event = makeEvent('customer.subscription.updated', makeSubscription());
    mockParseWebhookEvent.mockReturnValue(event);
    mockInsert.mockReturnValue(duplicateClaim());

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    // Must not proceed to upsert
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 500 on genuine DB insert error (non-23505 code)', async () => {
    const event = makeEvent('customer.subscription.updated', makeSubscription());
    mockParseWebhookEvent.mockReturnValue(event);
    mockInsert.mockReturnValue(dbErrorClaim());

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(500);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe('POST /api/stripe/webhook — subscription events', () => {
  beforeEach(() => {
    mockInsert.mockReturnValue(successClaim());
  });

  it('upserts subscription on customer.subscription.created', async () => {
    const sub = makeSubscription();
    const event = makeEvent('customer.subscription.created', sub);
    mockParseWebhookEvent.mockReturnValue(event);
    mockUpsert.mockResolvedValue(upsertOk());

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledOnce();
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.user_id).toBe('user-fixture-1');
    expect(upsertArg.stripe_subscription_id).toBe('sub_test_123');
  });

  it('upserts subscription on customer.subscription.updated', async () => {
    const sub = makeSubscription({ status: 'trialing' });
    const event = makeEvent('customer.subscription.updated', sub);
    mockParseWebhookEvent.mockReturnValue(event);

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockUpsert.mock.calls[0][0].status).toBe('trialing');
  });

  it('upserts subscription with status=canceled on customer.subscription.deleted', async () => {
    const sub = makeSubscription({ status: 'canceled' });
    const event = makeEvent('customer.subscription.deleted', sub);
    mockParseWebhookEvent.mockReturnValue(event);

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledOnce();
    // Explicitly assert the written status — catches regressions if someone
    // adds special-casing for deleted events later.
    expect(mockUpsert.mock.calls[0][0].status).toBe('canceled');
  });

  it('retrieves full subscription and upserts on invoice.paid', async () => {
    const sub = makeSubscription();
    const invoice = { subscription: 'sub_test_123' };
    const event = makeEvent('invoice.paid', invoice);
    mockParseWebhookEvent.mockReturnValue(event);
    mockStripeSubscriptionsRetrieve.mockResolvedValue(sub);

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(200);
    expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith('sub_test_123');
    expect(mockUpsert).toHaveBeenCalledOnce();
  });

  it('retrieves full subscription and upserts on invoice.payment_failed', async () => {
    const sub = makeSubscription({ status: 'past_due' });
    const invoice = { subscription: 'sub_test_123' };
    const event = makeEvent('invoice.payment_failed', invoice);
    mockParseWebhookEvent.mockReturnValue(event);
    mockStripeSubscriptionsRetrieve.mockResolvedValue(sub);

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(200);
    expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith('sub_test_123');
    expect(mockUpsert.mock.calls[0][0].status).toBe('past_due');
  });
});

describe('POST /api/stripe/webhook — error handling', () => {
  beforeEach(() => {
    mockInsert.mockReturnValue(successClaim());
  });

  it('returns 500 and marks event failed when upsertSubscription throws', async () => {
    const sub = makeSubscription();
    const event = makeEvent('customer.subscription.created', sub);
    mockParseWebhookEvent.mockReturnValue(event);
    mockUpsert.mockResolvedValue({ error: { message: 'DB write failed' } });

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(500);
    // The update to status=failed must be called
    const updateCalls = mockUpdate.mock.calls.map((c) => c[0]);
    expect(updateCalls.some((c) => c.status === 'failed')).toBe(true);
  });

  it('throws (via 500) when metadata.user_id is missing from subscription', async () => {
    const sub = makeSubscription({ metadata: {} }); // no user_id
    const event = makeEvent('customer.subscription.created', sub);
    mockParseWebhookEvent.mockReturnValue(event);

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(500);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 200 for an unknown/ignored event type', async () => {
    const event = makeEvent('payment_intent.created', {});
    mockParseWebhookEvent.mockReturnValue(event);
    mockInsert.mockReturnValue(successClaim());

    const res = await POST(makeRequest('{}', 't=1,v1=sig'));
    expect(res.status).toBe(200);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
