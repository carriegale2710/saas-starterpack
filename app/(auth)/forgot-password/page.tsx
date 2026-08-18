import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Forgot password?</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Recovery form wired up in Stage 3 */}
          <form className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" required />
            </div>
            <Button type="submit" className="w-full" disabled>
              Send reset link — wired in Stage 3
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-sm">
          <Link href="/login" className="text-muted-foreground underline">
            Back to log in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
