import Link from 'next/link';
import { APP_CONFIG } from '@/lib/config';

export function MarketingFooter() {
  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} {APP_CONFIG.name}. All rights reserved.</p>
        <nav className="flex gap-4">
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <a href={`mailto:${APP_CONFIG.supportEmail}`} className="hover:text-foreground">Support</a>
        </nav>
      </div>
    </footer>
  );
}
