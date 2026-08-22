/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for the authenticated user and
 * redirects them to the Stripe-hosted checkout page.
 *
 * Body (JSON): { priceId?: string }
 * Redirects to: Stripe Checkout URL on success
 * Returns:      401 if unauthenticated, 500 on Stripe error
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createCheckoutSession } from '@/lib/vendor/stripe/checkout';
import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';

export async function POST(request: NextRequest) {
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

  let priceId: string | undefined;
  try {
    const body = await request.json();
    priceId = body?.priceId;
  } catch {
    // No body — use default price
  }

  try {
    const session = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email ?? '',
      priceId,
    });

    return NextResponse.redirect(session.url!, { status: 303 });
  } catch (err) {
    console.error('[checkout] Stripe error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
