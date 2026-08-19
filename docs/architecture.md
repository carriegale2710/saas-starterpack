# Architecture Overview

System data flow and key architectural layers.  
Read this before making structural changes or adding new features.

> Implementation rules → `CLAUDE.md`  
> Decision rationale → `docs/decisions.md`  
> DB schema → `docs/schema.md`

---

## System Layers

```text
┌────────────────────────────────────────────────┐
│                    Browser                         │
│  Client Components  ↔  Server Components / RSC     │
└───────────────────┬───────────────────────────┘
                     │
            ┌───────▼───────┐
            │  middleware.ts  │  ← session check on every request
            │  (Vercel Edge)  │     redirects unauthenticated → /login
            └───────┬───────┘
                     │
       ┌───────────▼───────────┐
       │     Next.js App Router        │
       │                              │
       │  (marketing)/  public         │
       │  (auth)/        login etc.    │
       │  (dashboard)/  protected      │
       │  api/stripe/   checkout etc.  │
       │  api/auth/     OAuth callback │
       └──────┬───────────────────┘
              │
    ┌────────▼───────┐    ┌────────────────┐
    │   Supabase    │    │     Stripe        │
    │   Auth        │    │  Checkout        │
    │   PostgreSQL  │◄───│  Customer Portal │
    │   + RLS       │    │  Webhooks ──────┼──► subscriptions table
    └───────────────┘    └────────────────┘
```

---

## Request Flows

### Authenticated page request

```text
Browser → middleware.ts
  → no session → redirect /login
  → valid session → forward to (dashboard) route
    → Server Component calls lib/vendor/supabase/server.ts
    → Supabase RLS enforces user-scoped access
    → page rendered with data
```

### Stripe webhook event

```text
Stripe POST /api/stripe/webhook
  → verify signature
  → insert into webhook_events (status: 'pending')
  → claim event (status: 'processing')
  → entitlement event? → upsert subscriptions table
                           update webhook_events (status: 'processed')
                           [both writes in one DB transaction]
  → other event?      → update webhook_events (status: 'processed')
  → return 200
```

Full SQL and stale-processing recovery → [`docs/schema.md` → Atomic Webhook Processing](./schema.md#atomic-webhook-processing)

### Checkout flow

```text
User clicks Upgrade
  → POST /api/stripe/checkout → create Stripe Checkout Session
  → redirect to Stripe-hosted checkout
  → on success: Stripe fires checkout.session.completed webhook
    → webhook handler upserts subscription (source of truth)
  → user lands on /dashboard with active subscription
```

### Auth flow

```text
Email signup:  /signup → signUp() → confirm email → /auth/callback
               → exchangeCodeForSession() → session cookie → /dashboard

OAuth:         /login → signInWithOAuth() → provider → /auth/callback
               → exchangeCodeForSession() → session cookie → /dashboard

Password reset: /forgot-password → resetPasswordForEmail()
                → email link → /reset-password → updateUser({ password })
```

---

## Entitlement Logic

`lib/entitlements.ts` is the **only** place subscription access is evaluated.

```text
subscriptions.status + BILLING_CONFIG.pastDueGracePeriod
  → lib/entitlements.ts
  → hasAccess: boolean
```

Never check subscription status inline in components or routes — always go through `lib/entitlements.ts`.

Status → access mapping → [`docs/schema.md` → Entitlement Logic](./schema.md#entitlement-logic)

---

## Architectural Decisions

See [`docs/decisions.md`](./decisions.md) for all architectural decisions and rationale.

---

## Optional Modules

Optional features scaffold into `lib/modules/<name>/`. See [`docs/guides/adding-a-module.md`](./guides/adding-a-module.md) for the full contract and scaffold steps.
