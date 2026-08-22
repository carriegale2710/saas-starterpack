/**
 * Entitlements unit tests.
 *
 * hasActiveSubscription is a pure function — no mocks needed.
 * requireActiveSubscription calls next/navigation redirect() internally;
 * we stub it with vi.mock so no NEXT_REDIRECT throw leaks into the test.
 *
 * Import path: @/lib/vendor/stripe/entitlements (matches the actual module).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub next/navigation redirect before importing the module under test
const { mockRedirect } = vi.hoisted(() => ({ mockRedirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

// Stub createAdminClient so requireActiveSubscription can be tested in isolation
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

import {
  hasActiveSubscription,
  requireActiveSubscription,
} from '@/lib/vendor/stripe/entitlements';

beforeEach(() => vi.clearAllMocks());

describe('hasActiveSubscription', () => {
  it('returns true for active', () => {
    expect(hasActiveSubscription({ status: 'active' } as never)).toBe(true);
  });

  it('returns true for trialing', () => {
    expect(hasActiveSubscription({ status: 'trialing' } as never)).toBe(true);
  });

  it('returns false for past_due when pastDueGracePeriod is false (default)', () => {
    // BILLING_CONFIG.pastDueGracePeriod defaults to false — see billing.test.ts
    expect(hasActiveSubscription({ status: 'past_due' } as never)).toBe(false);
  });

  it('returns false for canceled', () => {
    expect(hasActiveSubscription({ status: 'canceled' } as never)).toBe(false);
  });

  it('returns false for unpaid', () => {
    expect(hasActiveSubscription({ status: 'unpaid' } as never)).toBe(false);
  });

  it('returns false for incomplete', () => {
    expect(hasActiveSubscription({ status: 'incomplete' } as never)).toBe(false);
  });

  it('returns false for incomplete_expired', () => {
    expect(hasActiveSubscription({ status: 'incomplete_expired' } as never)).toBe(false);
  });

  it('returns false for null (no subscription row)', () => {
    expect(hasActiveSubscription(null)).toBe(false);
  });
});

describe('requireActiveSubscription', () => {
  it('calls redirect("/pricing") when user has no active subscription', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    await requireActiveSubscription('user-no-sub');
    expect(mockRedirect).toHaveBeenCalledWith('/pricing');
  });

  it('calls redirect("/pricing") when subscription is canceled', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { status: 'canceled' },
      error: null,
    });
    await requireActiveSubscription('user-canceled');
    expect(mockRedirect).toHaveBeenCalledWith('/pricing');
  });

  it('does NOT call redirect when subscription is active', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { status: 'active' },
      error: null,
    });
    await requireActiveSubscription('user-active');
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
