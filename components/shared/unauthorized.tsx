import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function UnauthorizedMessage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">Sign in required</h1>
      <p className="text-sm text-muted-foreground">
        You need to be signed in to access this page.
      </p>
      <Button asChild>
        <Link href="/login">Log in</Link>
      </Button>
    </div>
  );
}
