/**
 * Central product configuration.
 * Change APP_CONFIG values to rebrand this template for any product.
 * Change BILLING_CONFIG to adjust subscription access policy.
 */
import { env } from '@/lib/env';

export const APP_CONFIG = {
  name: 'SaaS Starter',
  url: env.NEXT_PUBLIC_APP_URL,
  supportEmail: 'support@example.com',
} as const;

export const BILLING_CONFIG = {
  /**
   * Default: false — deny premium access when status is past_due.
   * Set to true only if you want a grace period (e.g. read-only access
   * while Stripe retries payment). Change with care.
   */
  pastDueGracePeriod: false,
} as const;

export const MARKETING_NAV: { label: string; href: string }[] = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
];
