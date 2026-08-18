import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Profile management connected in Stage 3</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Your profile information will appear here after Stage 3.</p>
        </CardContent>
      </Card>
    </div>
  );
}
