/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TICKETING_SUPABASE_URL?: string;
  readonly VITE_TICKETING_SUPABASE_ANON_KEY?: string;
  readonly VITE_TICKET_AI_SUPABASE_URL?: string;
  readonly VITE_TICKET_AI_SUPABASE_ANON_KEY?: string;
  readonly VITE_TICKETING_FUNCTIONS_SUPABASE_URL?: string;
  readonly VITE_TICKETING_FUNCTIONS_SUPABASE_ANON_KEY?: string;
  readonly VITE_MOMENCE_FUNCTION_URL?: string;
  readonly VITE_MOMENCE_FUNCTION_ANON_KEY?: string;
  readonly VITE_MOMENCE_SESSION_FUNCTION_URL?: string;
  readonly VITE_MOMENCE_SESSION_FUNCTION_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
