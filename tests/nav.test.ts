/**
 * Nav shape and sign-out integration tests.
 * These are pure logic tests — no DOM/browser required.
 */
import { describe, it, expect } from 'vitest';
import { MARKETING_NAV, DASHBOARD_NAV } from '@/lib/config';

describe('nav uniqueness', () => {
  it('MARKETING_NAV has no duplicate hrefs', () => {
    const hrefs = MARKETING_NAV.map((i) => i.href);
    expect(hrefs).toEqual([...new Set(hrefs)]);
  });

  it('MARKETING_NAV has no duplicate labels', () => {
    const labels = MARKETING_NAV.map((i) => i.label);
    expect(labels).toEqual([...new Set(labels)]);
  });

  it('DASHBOARD_NAV has no duplicate hrefs', () => {
    const hrefs = DASHBOARD_NAV.map((i) => i.href);
    expect(hrefs).toEqual([...new Set(hrefs)]);
  });

  it('DASHBOARD_NAV has no duplicate labels', () => {
    const labels = DASHBOARD_NAV.map((i) => i.label);
    expect(labels).toEqual([...new Set(labels)]);
  });
});

describe('nav does not bleed across groups', () => {
  it('MARKETING_NAV contains no /dashboard routes', () => {
    const hasDashboard = MARKETING_NAV.some((i) => i.href.startsWith('/dashboard'));
    expect(hasDashboard).toBe(false);
  });

  it('DASHBOARD_NAV contains no marketing-only routes', () => {
    const marketingOnlyRoutes = ['/#features', '/pricing'];
    const leaked = DASHBOARD_NAV.filter((i) => marketingOnlyRoutes.includes(i.href));
    expect(leaked).toHaveLength(0);
  });
});
