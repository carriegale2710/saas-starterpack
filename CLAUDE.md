# CLAUDE.md — SaaS Starterpack Development Guide

## 1. Project Structure

```
saas-starterpack/
├── app/
│   ├── (dashboard)/
│   │   ├── billing/
│   │   │   └── page.tsx          # Billing dashboard with subscription status
│   │   └── layout.tsx            # Dashboard layout with auth guard
│   ├── (marketing)/
│   │   ├── pricing/
│   │   │   └── page.tsx          # Pricing page with Pro CTA
│   │   └── layout.tsx            # Marketing layout
│   └── api/
│       └── stripe/
│           ├── checkout/
│           │   └── route.ts      # POST: Create Checkout Session
│           ├── portal/
│           │   └── route.ts      # POST: Create Portal Session
│           └── webhook/
│               └── route.ts      # POST: Handle webhook events
├── lib/
│   ├── vendor/
│   │   └── stripe/
│   │       ├── client.ts         # Singleton Stripe client
│   │       ├── checkout.ts       # createCheckoutSession()
│   │       ├── entitlements.ts   # hasActiveSubscription(), etc.
│   │       ├── portal.ts         # createPortalSession()
│   │       └── webhook.ts        # parseWebhookEvent(), handleWebhookEvent()
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   ├── server.ts             # Server Supabase client
│   │   └── admin.ts              # Service-role client (server only)
│   ├── config.ts                 # BILLING_CONFIG with pastDueGracePeriod
│   ├── env.ts                    # Zod schema for env validation
│   └── types.ts                  # Shared type aliases
├── tests/
│   ├── billing.test.ts           # Billing flow tests (activated)
│   ├── checkout.test.ts          # Checkout session tests
│   ├── entitlements.test.ts      # Entitlement logic tests
│   ├── webhook.test.ts           # Webhook handler tests (activated)
│   ├── config.test.ts            # Config validation tests
│   ├── env.test.ts               # Env var tests
│   ├── nav.test.ts               # Navigation tests
│   ├── rls.test.ts               # RLS policy tests
│   ├── setup.ts                  # Test setup with mocks
│   └── README.md                 # Test documentation
├── docs/
│   ├── architecture.md           # System architecture
│   ├── decisions.md              # Architectural decisions (ADRs)
│   ├── implementation-plan.md    # Implementation roadmap
│   ├── prompt-plan.md            # Prompt engineering plan
│   ├── schema.md                 # Database schema
│   └── toolchain.md              # Tool and dependency versions
├── .github/
│   └── workflows/
│       └── ci.yml                # CI pipeline with test, lint, typecheck
├── .env.example                  # Environment variable template
├── CHANGELOG.md                  # Project changelog
├── CLAUDE.md                     # This file
├── README.md                     # Project README
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── vitest.config.ts              # Vitest config
└── next.config.ts                # Next.js config
```

## 2. Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.x (strict mode)
- **Styling**: Tailwind CSS 4.x
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Billing**: Stripe (SDK v17.x, API version 2025-11-20.acacia)
- **Testing**: Vitest
- **Deployment**: Vercel

## 3. Development Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Validate (lint + typecheck + test)
npm run validate
```

## 4. Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_API_VERSION=2025-11-20.acacia
```

## 5. Stripe Integration

### Webhook Setup

1. Run Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
2. Use the displayed webhook secret in `STRIPE_WEBHOOK_SECRET`
3. Test with: `stripe trigger customer.subscription.created`

### Key Files

- `lib/vendor/stripe/` — Server-only Stripe module (never imported in browser)
- `app/api/stripe/webhook/route.ts` — Atomic claim pattern for idempotency
- `lib/supabase/admin.ts` — Service-role client for trusted server ops

## 6. Testing

- All tests mock Stripe and Supabase — no real credentials
- Webhook tests cover idempotency, event routing, and stale recovery
- Billing tests cover checkout contract, status mapping, and entitlements
- Run `npm run validate` for full validation

## 7. Architectural Decisions

See `docs/decisions.md` for full ADRs including:
- Decision #12: Stripe SDK version pinning
- Decision #13: Atomic claim pattern for webhooks
- Decision #14: Service-role client for entitlements

## 8. Conventions

- **No Stripe imports outside `lib/vendor/stripe/`**
- **Service-role client never exposed to browser**
- **All webhook events processed idempotently**
- **`past_due` grace period off by default**
- **TypeScript strict mode enforced**
