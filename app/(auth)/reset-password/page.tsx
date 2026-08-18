import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Set new password' };

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Choose a strong password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Reset form wired up in Stage 3 */}
          <form className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" required />
            </div>
            <Button type="submit" className="w-full" disabled>
              Update password — wired in Stage 3
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
