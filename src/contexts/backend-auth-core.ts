import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AccessRole } from '@/lib/access-control';

export interface BackendProfile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  team?: string | null;
}

export interface BackendAuthContextValue {
  session: Session | null;
  user: User | null;
  profile: BackendProfile | null;
  accessRole: AccessRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export const BackendAuthContext = createContext<BackendAuthContextValue | null>(null);
