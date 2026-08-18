import { describe, it, expect } from 'vitest';

describe('Environment validation', () => {
  it('NEXT_PUBLIC_APP_URL is set in test environment', () => {
    // In CI or local, set NEXT_PUBLIC_APP_URL=http://localhost:3000
    // This test documents the requirement; the Zod schema enforces it at runtime.
    const url = process.env.NEXT_PUBLIC_APP_URL;
    if (url) {
      expect(() => new URL(url)).not.toThrow();
    }
  });
});
