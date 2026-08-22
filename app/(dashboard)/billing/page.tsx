/**
 * Billing page — shows the user’s current plan and subscription status.
 * Uses the service-role client so the subscription lookup bypasses RLS
 * (the user is authenticated via the dashboard layout guard).
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasActiveSubscription } from '@/lib/vendor/stripe/entitlements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const isActive = hasActiveSubscription(subscription);

  const statusLabel = subscription
    ? subscription.status.replace(/_/g, ' ')
    : 'No subscription';

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current plan</CardTitle>
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? 'Pro' : 'Free'}
            </Badge>
          </div>
          <CardDescription>
            Status:{' '}
            <span className="capitalize font-medium text-foreground">
              {statusLabel}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {periodEnd && (
            <p className="text-sm text-muted-foreground">
              {subscription?.cancel_at_period_end
                ? `Cancels on ${periodEnd}`
                : `Renews on ${periodEnd}`}
            </p>
          )}

          {isActive ? (
            <form action="/api/stripe/portal" method="POST">
              <Button type="submit" variant="outline" className="w-full">
                Manage subscription
              </Button>
            </form>
          ) : (
            <form action="/api/stripe/checkout" method="POST">
              <Button type="submit" className="w-full">
                Upgrade to Pro
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
