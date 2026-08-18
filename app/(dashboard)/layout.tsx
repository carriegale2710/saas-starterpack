import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { UnauthorizedMessage } from '@/components/shared/unauthorized';

// TODO Stage 3: replace this placeholder with real session check via Supabase
const IS_AUTHENTICATED_PLACEHOLDER = false;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Stage 3 will replace this with: const session = await getServerSession()
  if (IS_AUTHENTICATED_PLACEHOLDER) {
    return <UnauthorizedMessage />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav />
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
