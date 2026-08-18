import Link from 'next/link';
import { APP_CONFIG } from '@/lib/config';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
          <LoginForm />
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
