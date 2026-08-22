# SaaS Starterpack

A minimal, maintainable modular monolith for solo-founder subscription SaaS products.

## Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- Supabase account
- Stripe account (test mode)

### Installation

```bash
# Clone and install
git clone <repo>
cd saas-starterpack
npm install

# Copy env template
cp .env.example .env.local

# Fill in your credentials (see Environment Variables below)

# Run dev server
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe (required for billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_API_VERSION=2025-11-20.acacia
```

### Stripe Webhook Setup

1. **Install Stripe CLI**: `brew install stripe/stripe-cli/stripe` (macOS) or from stripe.com
2. **Start local webhook forwarding**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
3. **Copy the webhook secret** from the CLI output to `STRIPE_WEBHOOK_SECRET`
4. **Test webhook delivery**:
   ```bash
   stripe trigger customer.subscription.created
   ```

### Stale Processing Recovery

If a webhook event gets stuck in `processing` status, run this recovery query:

```sql
-- Find stale processing rows (updated_at > 10 minutes ago)
SELECT stripe_event_id, event_type, updated_at
FROM webhook_events
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- Reset to pending for reprocessing (use with caution)
UPDATE webhook_events
SET status = 'pending', updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

## Features

- ✅ Next.js 15 App Router with TypeScript
- ✅ Supabase Auth (email/password, magic link)
- ✅ Stripe Checkout + Customer Portal
- ✅ Webhook-synced subscriptions
- ✅ Server-side entitlement checks
- ✅ Billing dashboard with live status
- ✅ Comprehensive test suite (Vitest)
- ✅ CI/CD ready (GitHub Actions + Vercel)

## Project Structure

```
app/
├── (dashboard)/     # Authenticated dashboard pages
├── (marketing)/     # Public marketing pages
└── api/stripe/      # Stripe API routes
lib/
├── vendor/stripe/   # Server-only Stripe module
└── supabase/        # Supabase clients
tests/               # Vitest test suite
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Full validation (lint + typecheck + test)
npm run validate
```

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables (Production)

- All `.env.local` vars above
- `STRIPE_WEBHOOK_SECRET` from production webhook endpoint
- Production Stripe price ID

## Documentation

- `docs/architecture.md` — System architecture
- `docs/decisions.md` — Architectural decisions (ADRs)
- `docs/implementation-plan.md` — Implementation roadmap
- `docs/schema.md` — Database schema
- `tests/README.md` — Test suite documentation

## License

MIT
