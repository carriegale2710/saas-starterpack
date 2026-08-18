import { describe, it, expect } from 'vitest';
import { APP_CONFIG, BILLING_CONFIG } from '@/lib/config';

describe('APP_CONFIG', () => {
  it('has a non-empty name', () => {
    expect(APP_CONFIG.name).toBeTruthy();
  });

  it('has a support email', () => {
    expect(APP_CONFIG.supportEmail).toContain('@');
  });
});

describe('BILLING_CONFIG', () => {
  it('defaults pastDueGracePeriod to false', () => {
    expect(BILLING_CONFIG.pastDueGracePeriod).toBe(false);
  });
});
