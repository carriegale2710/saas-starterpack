/**
 * Server Supabase client — for use in Server Components, Server Actions, and Route Handlers.
 * Uses the anon key with the authenticated user's session via cookies.
 * Always call getUser() — never getSession() — for server-side auth checks.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies can only be set
            // in middleware or Server Actions. The middleware handles refresh.
          }
        },
      },
    }
  );
}
