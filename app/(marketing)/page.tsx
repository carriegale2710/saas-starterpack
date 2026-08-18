import Link from 'next/link';
import { APP_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="container flex flex-col items-center gap-6 py-24 text-center md:py-32">
        <Badge variant="secondary">Open Source Template</Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Ship your SaaS faster
        </h1>
        <p className="max-w-[42rem] text-lg text-muted-foreground">
          {APP_CONFIG.description}
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/signup">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold">Everything you need</h2>
          <p className="mt-2 text-muted-foreground">Built-in features to launch fast</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

const FEATURES = [
  { title: 'Authentication', description: 'Signup, login, and password recovery out of the box.' },
  { title: 'Subscriptions', description: 'Stripe Checkout, portal, and webhook sync.' },
  { title: 'Database', description: 'Supabase PostgreSQL with Row Level Security.' },
  { title: 'Entitlements', description: 'Gate features by subscription status.' },
  { title: 'Modular', description: 'Add email, analytics, or AI as optional modules.' },
  { title: 'Production-ready', description: 'Deploy to Vercel in minutes.' },
];
