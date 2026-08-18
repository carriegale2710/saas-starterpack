import Link from 'next/link';
import { APP_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
};

export default function PricingPage() {
  return (
    <section className="container py-20">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold">Simple pricing</h1>
        <p className="mt-2 text-muted-foreground">Start free, upgrade when you need more.</p>
      </div>
      <div className="mx-auto grid max-w-3xl gap-8 sm:grid-cols-2">
        {/* Free tier */}
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>Get started at no cost</CardDescription>
            <p className="text-4xl font-bold">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Public marketing page</li>
              <li>✓ Authentication</li>
              <li>✓ Basic dashboard</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/signup">Get started</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Pro tier */}
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pro</CardTitle>
              <Badge>Popular</Badge>
            </div>
            <CardDescription>For serious builders</CardDescription>
            <p className="text-4xl font-bold">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ Everything in Free</li>
              <li>✓ Stripe billing</li>
              <li>✓ Premium features</li>
              <li>✓ Priority support</li>
            </ul>
          </CardContent>
          <CardFooter>
            {/* Checkout action added in Stage 4 */}
            <Button className="w-full" disabled>
              Subscribe — coming in Stage 4
            </Button>
          </CardFooter>
        </Card>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Questions? Email{' '}
        <a href={`mailto:${APP_CONFIG.supportEmail}`} className="underline">
          {APP_CONFIG.supportEmail}
        </a>
      </p>
    </section>
  );
}
