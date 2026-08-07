import { describe, expect, it } from 'vitest';
import { resolveSupabaseEnv } from '../../vite.config';

describe('resolveSupabaseEnv', () => {
  it('uses Vite-loaded env values for Supabase config', () => {
    expect(resolveSupabaseEnv({
      VITE_TICKETING_SUPABASE_URL: 'https://example.supabase.co',
      VITE_TICKETING_SUPABASE_ANON_KEY: 'anon-key',
    })).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });

  it('keeps the legacy swapped value guard', () => {
    expect(resolveSupabaseEnv({
      VITE_TICKETING_SUPABASE_URL: 'anon-key',
      VITE_TICKETING_SUPABASE_ANON_KEY: 'https://example.supabase.co',
    })).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });
});
