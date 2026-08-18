import { describe, it, expect } from 'vitest';
import { APP_CONFIG, BILLING_CONFIG, MARKETING_NAV, DASHBOARD_NAV } from '@/lib/config';

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

describe('MARKETING_NAV', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(MARKETING_NAV)).toBe(true);
    expect(MARKETING_NAV.length).toBeGreaterThan(0);
  });

  it('every item has a non-empty label and href', () => {
    for (const item of MARKETING_NAV) {
      expect(item.label).toBeTruthy();
      expect(item.href).toBeTruthy();
    }
  });

  it('every href starts with /', () => {
    for (const item of MARKETING_NAV) {
      expect(item.href.startsWith('/')).toBe(true);
    }
  });
});

describe('DASHBOARD_NAV', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DASHBOARD_NAV)).toBe(true);
    expect(DASHBOARD_NAV.length).toBeGreaterThan(0);
  });

  it('every item has a non-empty label and href', () => {
    for (const item of DASHBOARD_NAV) {
      expect(item.label).toBeTruthy();
      expect(item.href).toBeTruthy();
    }
  });

  it('every href starts with /', () => {
    for (const item of DASHBOARD_NAV) {
      expect(item.href.startsWith('/')).toBe(true);
    }
  });

  it('includes a /dashboard entry', () => {
    expect(DASHBOARD_NAV.some((item) => item.href === '/dashboard')).toBe(true);
  });
});
