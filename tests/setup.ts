/**
 * Vitest global setup — runs before every test file.
 * Stubs all required env vars so modules that call envSchema.parse(process.env)
 * at import time (lib/env.ts) don't throw during unit tests.
 *
 * Use realistic-looking but non-functional placeholder values.
 * Never put real secrets here.
 */
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
