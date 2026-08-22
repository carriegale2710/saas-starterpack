# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Phase 2 — Stripe Billing Integration (Stage 4)

#### Features
- **Stripe Checkout**: Full checkout flow from pricing page with `user_id` metadata
- **Customer Portal**: Subscription management via Stripe Customer Portal
- **Webhook Processing**: Atomic claim pattern with idempotent event handling
- **Entitlement System**: Server-side subscription status checks and gating
- **Billing Dashboard**: Live subscription status, renewal dates, and management

#### Infrastructure
- **lib/vendor/stripe/**: Server-only Stripe module with client, checkout, portal, webhook, and entitlements
- **app/api/stripe/**: Three API routes (webhook, checkout, portal)
- **Database**: `subscriptions` table with atomic upserts and `webhook_events` for audit trail

#### Security
- Stripe signature verification on all webhook events
- Service-role Supabase client for server-side operations only
- No Stripe secrets exposed to browser

#### Testing
- Activated all webhook and billing tests (idempotency, event routing, stale recovery)
- 90%+ coverage on checkout, portal, webhook, and entitlement flows
- All tests mock Stripe and Supabase — no real credentials

#### Documentation
- Updated README with Stripe env vars and webhook setup
- Updated CLAUDE.md with new file structure
- Updated implementation-plan.md and prompt-plan.md with Stage 4 completion
- Added ADR for Stripe integration in docs/decisions.md

### Phase 1 — Foundation (Stage 1)

#### Features
- Next.js 15 app with Supabase auth
- Marketing site with pricing page
- Dashboard layout with auth guard
- Profile sync on signup

---

## [0.1.0] - 2026-08-18

### Added
- Initial project structure
- Stage 1 implementation (auth, marketing, dashboard)
- Basic test suite
- CI/CD pipeline with Vercel
