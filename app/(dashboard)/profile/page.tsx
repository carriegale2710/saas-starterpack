import { redirect } from 'next/navigation';
import { createClient } from '@/lib/vendor/supabase/server';
import { ProfileForm } from '@/components/dashboard/profile-form';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Profile</h1>
      <ProfileForm profile={profile} />
    </div>
  );
}
