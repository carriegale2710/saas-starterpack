import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Billing' };

export default function BillingPage() {
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
            <Badge variant="secondary">Free</Badge>
          </div>
          <CardDescription>Stripe billing connected in Stage 4</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Subscription management will appear here after Stage 4.</p>
        </CardContent>
      </Card>
    </div>
  );
}
