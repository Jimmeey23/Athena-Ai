import { createClient } from '@supabase/supabase-js';

const backendSupabaseUrl = import.meta.env.VITE_TICKETING_SUPABASE_URL as string;
const backendSupabaseAnonKey = import.meta.env.VITE_TICKETING_SUPABASE_ANON_KEY as string;

const missingConfig = !backendSupabaseUrl || !backendSupabaseAnonKey;

if (missingConfig) {
  console.warn(
    '[Athena] Supabase credentials not set. Set VITE_TICKETING_SUPABASE_URL and VITE_TICKETING_SUPABASE_ANON_KEY to enable live data. Running in offline/demo mode.'
  );
}

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key';

const ticketingFunctionsSupabaseUrl =
  import.meta.env.VITE_TICKET_AI_SUPABASE_URL ||
  import.meta.env.VITE_TICKETING_FUNCTIONS_SUPABASE_URL ||
  backendSupabaseUrl ||
  PLACEHOLDER_URL;
const ticketingFunctionsSupabaseAnonKey =
  import.meta.env.VITE_TICKET_AI_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_TICKETING_FUNCTIONS_SUPABASE_ANON_KEY ||
  backendSupabaseAnonKey ||
  PLACEHOLDER_KEY;

export const backendSupabase = createClient(
  backendSupabaseUrl || PLACEHOLDER_URL,
  backendSupabaseAnonKey || PLACEHOLDER_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'p57-ticketing-auth',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

export const ticketingFunctionsSupabase = createClient(
  ticketingFunctionsSupabaseUrl,
  ticketingFunctionsSupabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

export const isSupabaseConfigured = !missingConfig;
