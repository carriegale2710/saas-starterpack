import { describe, it, expect } from 'vitest';
import { hasActiveSubscription } from '@/lib/entitlements';

describe('hasActiveSubscription', () => {
  it('returns true for active subscription', () => {
    expect(hasActiveSubscription({ status: 'active' })).toBe(true);
  });

  it('returns true for trialing subscription', () => {
    expect(hasActiveSubscription({ status: 'trialing' })).toBe(true);
  });

  it('returns false for past_due when grace period is disabled', () => {
    expect(hasActiveSubscription({ status: 'past_due' })).toBe(false);
  });

  it('returns false for canceled subscription', () => {
    expect(hasActiveSubscription({ status: 'canceled' })).toBe(false);
  });

  it('returns false for unpaid subscription', () => {
    expect(hasActiveSubscription({ status: 'unpaid' })).toBe(false);
  });

  it('returns false for incomplete subscription', () => {
    expect(hasActiveSubscription({ status: 'incomplete' })).toBe(false);
  });

  it('returns false for incomplete_expired subscription', () => {
    expect(hasActiveSubscription({ status: 'incomplete_expired' })).toBe(false);
  });

  it('returns false for null (no subscription)', () => {
    expect(hasActiveSubscription(null)).toBe(false);
  });
});
