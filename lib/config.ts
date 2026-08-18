/**
 * Central product configuration.
 * All product-specific values live here — never hard-code them in components or routes.
 */

export const APP_CONFIG = {
  name: 'SaaS Starter',
  description: 'The minimal, maintainable starter for subscription SaaS products.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  supportEmail: 'support@example.com',
} as const;

/**
 * Billing configuration.
 * past_due access is a product decision — change it here, never in entitlements.ts.
 *
 * Default: false — deny access immediately on past_due.
 * Set to true only if you deliberately want a grace period while Stripe retries payment.
 */
export const BILLING_CONFIG = {
  pastDueGracePeriod: false,
} as const;

/**
 * Navigation links for the marketing site.
 */
export const MARKETING_NAV = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
] as const;

/**
 * Navigation links for the authenticated dashboard.
 */
export const DASHBOARD_NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Billing', href: '/billing' },
  { label: 'Profile', href: '/profile' },
] as const;
