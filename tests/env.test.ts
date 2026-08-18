import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('env schema', () => {
  it('rejects missing NEXT_PUBLIC_APP_URL', () => {
    const schema = z.object({ NEXT_PUBLIC_APP_URL: z.string().url() });
    expect(() => schema.parse({})).toThrow();
  });

  it('rejects invalid URL for NEXT_PUBLIC_APP_URL', () => {
    const schema = z.object({ NEXT_PUBLIC_APP_URL: z.string().url() });
    expect(() => schema.parse({ NEXT_PUBLIC_APP_URL: 'not-a-url' })).toThrow();
  });

  it('accepts a valid URL', () => {
    const schema = z.object({ NEXT_PUBLIC_APP_URL: z.string().url() });
    expect(() => schema.parse({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' })).not.toThrow();
  });

  it('rejects missing NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    const schema = z.object({ NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1) });
    expect(() => schema.parse({})).toThrow();
  });
});
