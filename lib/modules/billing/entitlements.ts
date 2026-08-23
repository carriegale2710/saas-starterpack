/**
 * Entitlement check functions for the billing module.
 * 
 * These functions determine what features a user can access based on their subscription.
 * They read from the Supabase subscriptions table (synced from Stripe webhooks).
 */

import { getSubscriptionByUserId, isActiveSubscription } from './queries';
import type { Subscription, Plan, EntitlementResult } from './types';

/**
 * Features that can be gated by subscription tier.
 * 
 * Add new features here as you build them.
 */
export type Feature =
  | 'dashboard'
  | 'advanced_analytics'
  | 'team_collaboration'
  | 'api_access'
  | 'custom_branding'
  | 'priority_support';

/**
 * Define which plans have access to which features.
 * 
 * This is a simple allow-list approach. You can make this more sophisticated
 * by adding feature metadata, usage limits, etc.
 */
const FEATURE_ALLOWLIST: Record<Plan, Feature[]> = {
  free: ['dashboard'],
  pro: ['dashboard', 'advanced_analytics', 'api_access'],
  enterprise: [
    'dashboard',
    'advanced_analytics',
    'team_collaboration',
    'api_access',
    'custom_branding',
    'priority_support',
  ],
};

/**
 * Check if a subscription has access to a specific feature.
 * 
 * @param subscription - The user's subscription record
 * @param feature - The feature to check
 * @returns Whether the user has access
 */
function hasFeatureAccess(
  subscription: Subscription | null,
  feature: Feature
): boolean {
  if (!subscription) {
    return false;
  }
  
  if (!isActiveSubscription(subscription)) {
    return false;
  }
  
  const allowedFeatures = FEATURE_ALLOWLIST[subscription.plan];
  return allowedFeatures.includes(feature);
}

/**
 * Check if a user can access a specific feature.
 * 
 * This is the main entitlement check function. Use this in:
 * - Server components to conditionally render UI
 * - API routes to protect endpoints
 * - Middleware for route-level protection
 * 
 * @param userId - The user's ID
 * @param feature - The feature to check
 * @returns Whether the user has access
 * 
 * @example
 * ```typescript
 * // In a server component
 * const canAccess = await canAccessFeature(userId, 'advanced_analytics');
 * if (!canAccess) {
 *   redirect('/billing');
 * }
 * ```
 */
export async function canAccessFeature(
  userId: string,
  feature: Feature
): Promise<boolean> {
  const subscription = await getSubscriptionByUserId(userId);
  return hasFeatureAccess(subscription, feature);
}

/**
 * Get a user's subscription with entitlement information.
 * 
 * @param userId - The user's ID
 * @returns The subscription record, or null if not found
 * 
 * @example
 * ```typescript
 * const subscription = await getSubscription(userId);
 * if (!subscription) {
 *   // User has no subscription
 * }
 * ```
 */
export async function getSubscription(
  userId: string
): Promise<Subscription | null> {
  return getSubscriptionByUserId(userId);
}

/**
 * Get a user's subscription status.
 * 
 * @param userId - The user's ID
 * @returns The subscription status, or null if no subscription
 * 
 * @example
 * ```typescript
 * const status = await getSubscriptionStatus(userId);
 * if (status === 'active') {
 *   // Show active subscription UI
 * }
 * ```
 */
export async function getSubscriptionStatus(
  userId: string
): Promise<import('./types').SubscriptionStatus | null> {
  const subscription = await getSubscriptionByUserId(userId);
  return subscription?.status ?? null;
}

/**
 * Check multiple features at once.
 * 
 * @param userId - The user's ID
 * @param features - Array of features to check
 * @returns Map of feature names to access results
 * 
 * @example
 * ```typescript
 * const access = await checkFeatures(userId, ['dashboard', 'api_access']);
 * // { dashboard: true, api_access: false }
 * ```
 */
export async function checkFeatures(
  userId: string,
  features: Feature[]
): Promise<Record<Feature, boolean>> {
  const subscription = await getSubscriptionByUserId(userId);
  
  const result: Record<Feature, boolean> = {} as Record<Feature, boolean>;
  for (const feature of features) {
    result[feature] = hasFeatureAccess(subscription, feature);
  }
  
  return result;
}

/**
 * Get all features available to a user's plan.
 * 
 * @param userId - The user's ID
 * @returns Array of available features
 */
export async function getAvailableFeatures(
  userId: string
): Promise<Feature[]> {
  const subscription = await getSubscriptionByUserId(userId);
  
  if (!subscription || !isActiveSubscription(subscription)) {
    return [];
  }
  
  return FEATURE_ALLOWLIST[subscription.plan];
}
