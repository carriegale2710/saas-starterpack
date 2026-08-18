/**
 * Typed, validated environment variables.
 * Import `env` everywhere — never read process.env directly.
 * Validation runs at startup; missing or malformed variables cause an immediate crash.
 */
import { z } from 'zod';

const envSchema = z.object({
  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe (uncomment in Stage 4)
  // STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  // STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  // STRIPE_PRICE_ID_PRO: z.string().startsWith('price_'),
  // STRIPE_API_VERSION: z.string().min(1),
});

export const env = envSchema.parse(process.env);
