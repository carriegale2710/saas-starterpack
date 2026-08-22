/**
 * Shared type aliases derived from the generated database types.
 * Import from here rather than reaching into database.types.ts directly.
 */
export type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from './database.types';

import type { Database } from './database.types';

/** The set of valid Stripe subscription statuses stored in the DB. */
export type SubscriptionStatus =
  Database['public']['Enums']['subscription_status'];

/** A full subscription row from Supabase. */
export type SubscriptionRow =
  Database['public']['Tables']['subscriptions']['Row'];

/** A full profile row from Supabase. */
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
