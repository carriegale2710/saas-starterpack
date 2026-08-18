/**
 * Server-only administrative Supabase client.
 * Uses the service-role key — bypasses RLS entirely.
 * NEVER import this in browser/client code or expose it to the client bundle.
 * Use only in trusted server contexts: webhook handlers, admin actions.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase service-role credentials');
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
