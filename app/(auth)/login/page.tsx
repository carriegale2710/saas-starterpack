import Link from 'next/link';
import { APP_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Log in to {APP_CONFIG.name}</CardDescription>
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
              Log in — wired in Stage 3
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-sm">
          <Link href="/forgot-password" className="text-muted-foreground underline">
            Forgot password?
          </Link>
          <span className="text-muted-foreground">
            No account?{' '}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
