/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for the authenticated user
 * and redirects them to manage or cancel their subscription.
 *
 * Requires the user to have a stripe_customer_id in their subscription row.
 * Returns 400 if no Stripe customer ID is found.
 */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createPortalSession } from '@/lib/vendor/stripe/portal';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';

export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch subscription using service-role client (bypasses RLS)
  const admin = createAdminClient();
  const { data: subscription, error } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[portal] Supabase error:', error.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No active subscription found' },
      { status: 400 }
    );
  }

  try {
    const session = await createPortalSession({
      stripeCustomerId: subscription.stripe_customer_id,
    });

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    console.error('[portal] Stripe error:', err);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
