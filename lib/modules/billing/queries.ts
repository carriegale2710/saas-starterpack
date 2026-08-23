/**
 * Supabase query functions for the billing module.
 * 
 * These functions handle all database access for subscription data.
 * They are internal to the billing module - use the public interface in index.ts instead.
 */

import { createClient } from '@supabase/supabase-js';
import type { Subscription, SubscriptionStatus, Plan } from './types';

/**
 * Get the Supabase client for server-side queries.
 * 
 * Uses the service-role key for privileged access (bypasses RLS).
 * This is only used server-side in webhook handlers and API routes.
 * 
 * @see https://supabase.com/docs/guides/auth/row-level-security#service-role-key
 */
function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

/**
 * Fetch a subscription by user ID.
 * 
 * @param userId - The user's ID
 * @returns The subscription record, or null if not found
 */
export async function getSubscriptionByUserId(
  userId: string
): Promise<Subscription | null> {
  const supabase = getSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    // Supabase returns 406 when no rows match .single()
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  
  return data as Subscription;
}

/**
 * Fetch a subscription by Stripe subscription ID.
 * 
 * @param stripeSubscriptionId - The Stripe subscription ID
 * @returns The subscription record, or null if not found
 */
export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string
): Promise<Subscription | null> {
  const supabase = getSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  
  return data as Subscription;
}

/**
 * Update or insert a subscription record.
 * 
 * This is used by the webhook handler to keep the subscriptions table
 * in sync with Stripe. Uses upsert to handle both new and existing subscriptions.
 * 
 * @param subscription - The subscription data to upsert
 * @returns The saved subscription record
 */
export async function upsertSubscription(
  subscription: Partial<Subscription> & {
    stripe_subscription_id: string;
    user_id: string;
  }
): Promise<Subscription> {
  const supabase = getSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(subscription, {
      onConflict: 'stripe_subscription_id',
    })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data as Subscription;
}

/**
 * Update a subscription's status.
 * 
 * @param userId - The user's ID
 * @param status - The new status
 * @returns The updated subscription record, or null if not found
 */
export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus
): Promise<Subscription | null> {
  const supabase = getSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  
  return data as Subscription;
}

/**
 * Check if a subscription is active (can access paid features).
 * 
 * @param subscription - The subscription to check
 * @returns true if the subscription is active or trialing
 */
export function isActiveSubscription(
  subscription: Subscription | null
): boolean {
  if (!subscription) {
    return false;
  }
  
  return subscription.status === 'active' || subscription.status === 'trialing';
}
