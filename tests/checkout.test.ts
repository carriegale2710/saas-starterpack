/**
 * POST /api/stripe/checkout — unit tests.
 *
 * Boundary: NextRequest-level, handler imported directly.
 * Mock seam: @/lib/vendor/stripe/checkout (createCheckoutSession) and
 * @supabase/ssr (createServerClient) are stubbed.
 *
 * Run: npm test -- tests/checkout.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockCreateCheckoutSession } = vi.hoisted(() => ({
  mockCreateCheckoutSession: vi.fn(),
}));
vi.mock('@/lib/vendor/stripe/checkout', () => ({
  createCheckoutSession: mockCreateCheckoutSession,
}));

// Auth stub — can be swapped per-test
let mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-fixture-1', email: 'test@example.com' } },
  error: null,
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: () => mockGetUser() },
  }),
}));

// cookies() stub
vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: vi.fn() }),
}));

import { POST } from '@/app/api/stripe/checkout/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/stripe/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'user-fixture-1', email: 'test@example.com' } },
    error: null,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/checkout', () => {
  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('calls createCheckoutSession with correct userId and userEmail', async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    });
    await POST(makeRequest());
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-fixture-1',
        userEmail: 'test@example.com',
      })
    );
  });

  it('uses STRIPE_PRICE_ID_PRO default when no priceId is in the request body', async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    });
    await POST(makeRequest()); // no body
    const call = mockCreateCheckoutSession.mock.calls[0][0];
    // priceId should be undefined — createCheckoutSession falls back to env var
    expect(call.priceId).toBeUndefined();
  });

  it('passes provided priceId to createCheckoutSession', async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    });
    await POST(makeRequest({ priceId: 'price_custom_456' }));
    expect(mockCreateCheckoutSession.mock.calls[0][0].priceId).toBe('price_custom_456');
  });

  it('returns 500 when createCheckoutSession throws', async () => {
    mockCreateCheckoutSession.mockRejectedValue(new Error('Stripe unavailable'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/checkout session/i);
  });

  it('redirects (303) to Stripe checkout URL on success', async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/cs_test_abc',
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(
      'https://checkout.stripe.com/pay/cs_test_abc'
    );
  });
});
