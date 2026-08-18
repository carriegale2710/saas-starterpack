import Link from 'next/link';
import { APP_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign up' };

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Get started with {APP_CONFIG.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Auth form wired up in Stage 3 */}
          <form className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required />
            </div>
            <Button type="submit" className="w-full" disabled>
              Sign up — wired in Stage 3
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-sm">
          <span className="text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="underline">
              Log in
            </Link>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
