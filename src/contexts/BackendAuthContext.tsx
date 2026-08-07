import React, { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { backendSupabase } from '@/lib/backend-supabase';
import { resolveAccessRole, type AccessRole } from '@/lib/access-control';
import { BackendAuthContext, type BackendAuthContextValue, type BackendProfile } from './backend-auth-core';

export const BackendAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<BackendProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setProfile(null);
      return;
    }
    const userId = nextSession.user.id;
    try {
      const { data } = await backendSupabase
        .from('profiles')
        .select('id,email,full_name,role,team')
        .eq('id', userId)
        .maybeSingle();
      // Guard against a stale profile resolving after sign-in/sign-out swapped users.
      const { data: currentSessionData } = await backendSupabase.auth.getSession();
      if (currentSessionData.session?.user.id !== userId) return;
      setProfile((data as BackendProfile | null) || {
        id: userId,
        email: nextSession.user.email,
        full_name: typeof nextSession.user.user_metadata?.full_name === 'string'
          ? nextSession.user.user_metadata.full_name
          : null,
        role: resolveAccessRole({
          email: nextSession.user.email,
          fullName: typeof nextSession.user.user_metadata?.full_name === 'string'
            ? nextSession.user.user_metadata.full_name
            : typeof nextSession.user.user_metadata?.name === 'string'
              ? nextSession.user.user_metadata.name
              : null,
        }),
      });
    } catch (error) {
      console.warn('Backend profile load failed:', error);
    }
  };

  useEffect(() => {
    let mounted = true;
    backendSupabase.auth.getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        await loadProfile(data.session);
      })
      .catch((error) => {
        console.warn('Backend session load failed:', error);
        setSession(null);
        setProfile(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: listener } = backendSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadProfile(nextSession).catch((error) => {
        console.warn('Backend auth state change profile load failed:', error);
      }).finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const accessRole: AccessRole = resolveAccessRole({
    email: profile?.email || session?.user.email,
    fullName: profile?.full_name ||
      (typeof session?.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name : '') ||
      (typeof session?.user.user_metadata?.name === 'string' ? session.user.user_metadata.name : ''),
    role: profile?.role,
  });

  const value = useMemo<BackendAuthContextValue>(() => ({
    session,
    user: session?.user || null,
    profile,
    accessRole,
    loading,
    signIn: async (email, password) => {
      const { error } = await backendSupabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signInWithGoogle: async () => {
      const { error } = await backendSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
    },
    signUp: async (email, password) => {
      const { data, error } = await backendSupabase.auth.signUp({ email, password });
      if (error) throw error;
      return { needsEmailConfirmation: !data.session };
    },
    signOut: async () => {
      const { error } = await backendSupabase.auth.signOut();
      if (error) throw error;
    },
  }), [accessRole, loading, profile, session]);

  return <BackendAuthContext.Provider value={value}>{children}</BackendAuthContext.Provider>;
};
