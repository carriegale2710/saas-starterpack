# SaaS Starterpack

[![CI](https://github.com/carriegale2710/saas-starterpack/actions/workflows/ci.yml/badge.svg)](https://github.com/carriegale2710/saas-starterpack/actions/workflows/ci.yml)

A minimal, maintainable modular monolith for solo-founder subscription SaaS products.

## Features

### Phase 1 — Complete ✅
- ✅ Public marketing page
- ✅ Authentication (Supabase Auth)
- ✅ Protected dashboard
- ✅ User profile management
- ✅ Supabase PostgreSQL with RLS
- ✅ Environment validation (Zod)
- ✅ Unit test suite (Vitest — 5 suites, 20 tests, all passing)
- ✅ GitHub Actions CI (lint, typecheck, tests)

### Phase 2 — In Progress 🔜
- ⬜ Stripe Checkout + Customer Portal
- ⬜ Stripe webhook synchronisation
- ⬜ Subscription entitlements

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui-style components
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth
- **Billing:** Stripe (Checkout, Portal, Webhooks) — Phase 2
- **Deployment:** Vercel

## Quick Start

### Prerequisites

- Node.js 22 LTS (see `.nvmrc`)
- npm (comes pre-installed with Node; no additional package manager needed)
- Supabase account (free tier)
- Stripe account (test mode) — Phase 2
- Vercel account (free tier)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/saas-starterpack.git
cd saas-starterpack
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# Supabase (required now)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (required in Phase 2)
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# STRIPE_PRICE_ID_PRO=price_...
# STRIPE_API_VERSION=2024-06-20
```

### 3. Supabase Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Login
npx supabase login

# Link to your project
npx supabase link --project-ref your-project-ref

# Apply migrations
npx supabase db push
```

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

### 5. Stripe Setup (Phase 2)

#### 5.1 Create Products & Prices

In Stripe Dashboard: **Products → Add product**, create "Pro Plan" with monthly price, copy price ID to `STRIPE_PRICE_ID_PRO`.

#### 5.2 Pin the Stripe Node SDK

Pin both the SDK version in `package.json` and the API version in `.env.local`. See [Stripe SDK & API Version Pinning](#stripe-sdk--api-version-pinning).

#### 5.3 Configure Webhooks

In Stripe Dashboard: **Developers → Webhooks**, add endpoint `https://your-domain.com/api/stripe/webhook` with these events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

### 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
# Set environment variables in Vercel dashboard, then:
vercel --prod
```

## App Routes

| Route            | File                                                         |
| ---------------- | ------------------------------------------------------------ |
| /                | app/(marketing)/page.tsx                                     |
| /pricing         | app/(marketing)/pricing/page.tsx                             |
| /login           | app/(auth)/login/page.tsx                                    |
| /signup          | app/(auth)/signup/page.tsx                                   |
| /forgot-password | app/(auth)/forgot-password/page.tsx                          |
| /reset-password  | app/(auth)/reset-password/page.tsx                           |
| /dashboard       | app/(dashboard)/dashboard/page.tsx + loading.tsx + error.tsx |
| /profile         | app/(dashboard)/profile/page.tsx                             |
| /billing         | app/(dashboard)/billing/page.tsx                             |
| 404              | app/not-found.tsx                                            |
| Global error     | app/error.tsx                                                |

## Database Schema

See [`docs/schema.md`](docs/schema.md) for complete schema definition and the initial migration at `supabase/migrations/0001_initial.sql`.

### Core Tables

- `profiles` — User profiles (synced from Auth)
- `subscriptions` — Subscription state (synced from Stripe)
- `webhook_events` — Webhook event log (idempotency)

### Row Level Security

All tables have RLS enabled. The **service-role key bypasses RLS entirely** — it is not granted access through any policy. Authenticated users access only their own rows via `auth.uid()` policies. The `webhook_events` table has no authenticated-user policies; the service-role key is the only means of access.

## Authentication

### Signup Flow

1. User visits `/signup`
2. Enters email + password
3. Supabase sends confirmation email
4. User clicks link → `/auth/callback`
5. Profile created in `profiles` table
6. Redirect to `/dashboard`

### Password Recovery

1. User visits `/forgot-password`
2. Enters email
3. Supabase sends reset link
4. User clicks link → `/reset-password`
5. Enters new password
6. Redirect to `/login`

## Stripe Integration (Phase 2)

### Checkout Flow

1. User visits `/pricing`
2. Selects plan → `/api/stripe/checkout`
3. Create Checkout Session with `user_id` metadata
4. Redirect to Stripe Checkout URL
5. User completes payment
6. Stripe redirects to `/dashboard?session_id=...`
7. Webhook `checkout.session.completed` creates subscription

### Customer Portal

1. User visits `/billing`
2. Click "Manage Billing" → `/api/stripe/portal`
3. Create Portal Session for customer
4. Redirect to Stripe Portal URL
5. User can update card, cancel, etc.
6. Webhook `customer.subscription.updated` syncs changes

### Webhook Events

| Event                           | Action                      |
| ------------------------------- | --------------------------- |
| `checkout.session.completed`    | Create subscription record  |
| `customer.subscription.created` | Create/update subscription  |
| `customer.subscription.updated` | Update subscription status  |
| `customer.subscription.deleted` | Mark subscription canceled  |
| `invoice.paid`                  | Update `current_period_end` |
| `invoice.payment_failed`        | Set status `past_due`       |

### Webhook Atomicity & Stale-Processing Recovery

The webhook handler uses a two-step database transaction:

1. **Claim**: `UPDATE webhook_events SET status = 'processing' WHERE stripe_event_id = $1 AND status = 'pending' RETURNING id` — if no row is returned, the event is already claimed; return 200 immediately.
2. **Process + commit**: the subscription upsert and the status update to `processed` run inside the **same database transaction**. A crash cannot leave a permanently misleading `processing` row because the transaction rolls back.

A stale `processing` row (worker crash before commit) is recovered by a scheduled job or manual query:

```sql
-- Reset events stuck in processing for more than 10 minutes
UPDATE webhook_events
SET status = 'pending', error_message = 'reset after stale processing'
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

Add `updated_at` to `webhook_events` to enable this query (see `docs/schema.md`).

## Entitlement Rules (Phase 2)

Entitlement policy is defined in `lib/config.ts` (`BILLING_CONFIG.pastDueGracePeriod`) and enforced in `lib/entitlements.ts`. The **default policy** for this template is:

| Status                             | Access Level                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `active`, `trialing`               | Full access                                                                                        |
| `past_due`                         | **No access** (deny by default — set `pastDueGracePeriod: true` in `lib/config.ts` for a grace period) |
| `canceled`, `unpaid`, `incomplete` | No access                                                                                          |
| No subscription                    | No access (deny by default)                                                                        |

## Testing

See [`tests/README.md`](tests/README.md) for full details.

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

### Current Status

5 suites · 20 tests · all passing ✅  
CI: Lint ✅ · Typecheck ✅ · Tests ✅

### Coverage Targets

- Authentication flow: 100%
- Webhook handlers: 90%
- Entitlement logic: 100%
- RLS policies: 80%

## Environment Variables

### Required (Phase 1)

| Variable                        | Description                         |
| ------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client)          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role (server only) |
| `NEXT_PUBLIC_APP_URL`           | App URL (for redirects)             |

### Required (Phase 2 — Stripe)

| Variable                        | Description                              |
| ------------------------------- | ---------------------------------------- |
| `STRIPE_SECRET_KEY`             | Stripe secret key (test or live)         |
| `STRIPE_WEBHOOK_SECRET`         | Stripe webhook signing secret            |
| `STRIPE_PRICE_ID_PRO`           | Stripe price ID for Pro plan             |
| `STRIPE_API_VERSION`            | Pinned Stripe API version string         |

### Optional

| Variable                  | Description               |
| ------------------------- | ------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics key     |
| `SENTRY_DSN`              | Sentry error tracking DSN |
| `RESEND_API_KEY`          | Resend email API key      |

## Stripe SDK & API Version Pinning

Pin **both** the SDK version in `package.json` and the API version in `.env.local`. They must be upgraded together:

```json
// package.json — pin exact version, not a range
"stripe": "16.3.0"
```

```bash
# .env.local
STRIPE_API_VERSION=2024-06-20
```

```typescript
// lib/vendor/stripe/client.ts
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: env.STRIPE_API_VERSION as Stripe.LatestApiVersion,
});
```

**Upgrade Process:**

1. Read Stripe changelog for the new version
2. Update `stripe` version in `package.json` and run `npm install`
3. Update `STRIPE_API_VERSION` in `.env.local`
4. Run the full test suite (`npm test`)
5. Test Checkout, Portal, and webhook flows manually
6. Deploy

## Optional Modules

Modules are opt-in. **Note:** `workspaces` and `usage-billing` are not schema-neutral — they may require new foreign keys or a billing-owner relationship. Review `docs/decisions.md` before adding them.

### Available Modules

- `workspaces` — Multi-tenant teams (**requires schema additions**)
- `usage-billing` — Metered usage + invoices (**requires schema additions**)
- `storage` — Supabase Storage wrappers
- `email` — Resend integration
- `analytics` — PostHog client
- `ai` — LLM API clients

### Adding a Module

```bash
npm install <module-deps>
npx supabase migration new add_<module>_tables
import { init } from '@/lib/modules/<module>';
init();
```

## Deployment Checklist

- [ ] Environment variables set in Vercel
- [ ] Supabase production project linked
- [ ] Stripe live mode keys configured
- [ ] Webhook endpoint updated to production URL
- [ ] Custom domain configured (optional)
- [ ] SSL certificate enabled (automatic on Vercel)
- [ ] Database migrations pushed to production (`npx supabase db push`)
- [ ] Test signup + checkout flow end-to-end

## Troubleshooting

### Supabase RLS Errors

```sql
-- Test RLS as an authenticated user
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "<user-id>"}';
SELECT * FROM profiles;
```

Service-role access bypasses RLS entirely and requires no policy — do not add `auth.uid() IS NULL` policies to simulate it.

### Stripe Webhook Failures

```bash
# Check event log
npx supabase table logs select --table webhook_events

# Replay failed event via Stripe CLI
stripe events resend <event-id>
```

### Vercel Build Errors

```bash
vercel logs <deployment-id>
npm run build
```

## Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -am 'Add my feature'`)
4. Push to branch (`git push origin feature/my-feature`)
5. Create Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)

---

**Built with ❤️ for solo founders**
