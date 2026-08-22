/**
 * POST /api/stripe/portal — unit tests.
 *
 * Boundary: NextRequest-level, handler imported directly.
 * Mock seam: @supabase/ssr, @/lib/supabase/admin, and
 * @/lib/vendor/stripe/portal are stubbed.
 *
 * Run: npm test -- tests/portal.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockCreatePortalSession } = vi.hoisted(() => ({
  mockCreatePortalSession: vi.fn(),
}));
vi.mock('@/lib/vendor/stripe/portal', () => ({
  createPortalSession: mockCreatePortalSession,
}));

let mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'user-fixture-1', email: 'test@example.com' } },
  error: null,
});
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: () => mockGetUser() },
  }),
}));

vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: vi.fn() }),
}));

const mockMaybeSingle = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
  }),
}));

import { POST } from '@/app/api/stripe/portal/route';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'user-fixture-1', email: 'test@example.com' } },
    error: null,
  });
  mockMaybeSingle.mockResolvedValue({
    data: { stripe_customer_id: 'cus_test_123' },
    error: null,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/portal', () => {
  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });
    const res = await POST();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('returns 400 when user has no stripe_customer_id', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/subscription/i);
  });

  it('returns 400 when subscription row exists but stripe_customer_id is null', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { stripe_customer_id: null },
      error: null,
    });
    const res = await POST();
    expect(res.status).toBe(400);
  });

  it('redirects (303) to Stripe portal URL on success', async () => {
    mockCreatePortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/test_bps_abc',
    });
    const res = await POST();
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(
      'https://billing.stripe.com/session/test_bps_abc'
    );
  });

  it('calls createPortalSession with the correct stripeCustomerId', async () => {
    mockCreatePortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/test_bps_abc',
    });
    await POST();
    expect(mockCreatePortalSession).toHaveBeenCalledWith(
      expect.objectContaining({ stripeCustomerId: 'cus_test_123' })
    );
  });

  it('returns 500 when createPortalSession throws', async () => {
    mockCreatePortalSession.mockRejectedValue(new Error('Stripe unavailable'));
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/portal session/i);
  });
});
