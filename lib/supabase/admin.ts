/**
 * Supabase service-role client.
 * Server-only — never import in browser/client components.
 * Bypasses Row Level Security — only use for trusted server operations
 * such as webhook handlers and background jobs.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * Returns a Supabase client authenticated with the service-role key.
 * Creates a new instance per call — no singleton — so it is safe in
 * serverless environments where module-level singletons can persist
 * across requests with stale state.
 */
export function createAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
