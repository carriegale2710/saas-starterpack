# The Leanest MVP Tech Stack for Solo Micro-SaaS Founders

![A detailed annotated diagram of a multilayered sandwich is drawn on whiteboard. Each annotation explains a technology choice, eg. supabase for BaaS, and points to a layer in the sandwich that represents part of the lean 'godstack' eg. backend, frontend, devops, core engine etc.](godstack.png)

## Key Considerations

Tech stack optimized for one-person teams. Focused on simplicity, low maintenance, and maximum productivity.

> Monthly Running Cost: $0-100.
> Initial Setup Cost: $0-200.

Important factors to keep in mind when building a solo developer.

- Choose boring technology you know well
- Use managed services for anything non-core
- Automate everything: deploys, backups, monitoring
- Build features, not infrastructure
- Keep dependencies minimal to reduce maintenance
- The easiest leanstack centers on a managed, single-repository monolith.

---

## Stack Architecture Overview

**Frontend**

- Next.js - Full-stack without managing separate services
- Typescript - Catches bugs in development
- Tailwind CSS - Ship without design decisions
- shadcn/ui - Beautiful components you fully control

**Backend**

- Next.js API Routes - No separate backend to deploy
- Prisma - Type-safe database access

**Database**

- Supabase - Managed Postgres with auth and storage
- PlanetScale - Serverless MySQL that scales

**Hosting**

- Vercel - Deploy with git push, no DevOps needed

**Extras**

- Clerk - Auth without building it yourself
- Stripe - Payments and billing handled
- Loops/Resend - Email without infrastructure
- Posthog - Analytics

---

## Deep dive into the stack + Alternatives

### Core Framework: Next.js + Typescript

- **Framework:** Next.js — Full-stack frontend and backend development in one repository.

**Next.js** is the consensus choice for the foundation. It is highly recommended because it allows you to build a **full-stack application in one place** using API routes and server actions, ensuring the frontend and backend fully understand each other.

- **Language:** TypeScript — End-to-end type safety to catch bugs in the editor rather than production.

### Backend & Database: Convex or Supabase

To keep the stack lean, developers are encouraged to avoid managing their own infrastructure.

- **Hosting:** Vercel — Optimized for Next.js, with fast deployments and managed infrastructure.
- **Convex:** Often cited as the easiest option for real-time functionality. It handles **WebSockets and synchronization automatically**, meaning your data updates instantly without you having to code the underlying real-time logic. It also provides **automatic TypeScript type safety** across your schema, queries, and API, which helps catch bugs before they reach production.
- **Supabase:** A robust "all-in-one" alternative that provides **PostgreSQL, authentication, and S3-like file storage** in a single platform. It is praised for its generous free tier and active developer community.

### Authentication & Billing: Stripe + Clerk

Traditional payment flows involving separate auth and Stripe webhooks are described as "annoying" and prone to errors. **Clerk** is the recommended solution because it integrates **authentication and billing** into one service.

- It handles multiple login methods (Google, GitHub, etc.) and provides pre-built UI components for user management.
- Its billing features allow you to add pricing tiers and subscriptions without writing hundreds of lines of complex webhook code.

### Operations and Growth

- **Analytics:** PostHog — Track events, session recordings, and heatmaps.
- **Email:** Resend — Send transactional emails through a simple API and React-based templates.
- **Error monitoring:** Sentry — Centralized production error reporting.

### UI & Styling: Tailwind CSS + shadcn/ui

To ensure the app is professional and "non-ugly" without wasting hours on custom CSS, the standard is **Tailwind CSS** paired with **shadcn/ui**.

- **Tailwind** provides utility classes for rapid styling.
- **shadcn/ui** offers reusable, accessible components that can be dropped into a project instantly.

> For rapid prototyping, use google stitch, figma make or [v0](https://v0.dev/) to generate UI components from prompts.

### AI-Powered Development ("Vibe Coding")

Solo founders can significantly accelerate their build time using AI tools that function as a "virtual CTO":

- **AI code editors:** Claude, Cursor or Windsurf — Build, rewrite, and review code with natural-language prompts.
- **App generation:** Replit, Google Studio, Bolt or Lovable — Generate functional MVPs, including frontend and database connections, from an initial prompt.
- **Research:** Perplexity — Create a technical game plan using current documentation for libraries and tools.
- **UX/UI Design:** Figma Make/MCP, Google Stitch for Figma editing, v0 by Vercel for component based
