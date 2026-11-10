
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile } from '../types';

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    const initializeAuth = async () => {
      try {
        const callbackUrl = new URL(window.location.href);
        const code = callbackUrl.searchParams.get('code');
        const callbackError = callbackUrl.searchParams.get('error_description') ?? callbackUrl.searchParams.get('error');

        if (callbackError) {
          throw new Error(callbackError);
        }

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) throw error;
          if (active) setSession(data.session);
        } else {
          const { data, error } = await supabase.auth.getSession();

          if (error) throw error;
          if (active) setSession(data.session);
        }

        if (code || callbackError) {
          callbackUrl.search = '';
          window.history.replaceState(window.history.state, document.title, `${callbackUrl.pathname}${callbackUrl.hash}`);
        }
      } catch (error) {
        console.error('Domyx Draw authentication initialization failed:', error);

        if (active) {
          setSession(null);
          setAuthError(error instanceof Error ? error.message : 'Unable to restore your session.');
        }

        const callbackUrl = new URL(window.location.href);

        if (callbackUrl.searchParams.has('code') || callbackUrl.searchParams.has('error')) {
          callbackUrl.search = '';
          window.history.replaceState(window.history.state, document.title, `${callbackUrl.pathname}${callbackUrl.hash}`);
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    void initializeAuth();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);

    supabase
      .from('profiles')
      .select('id,username,full_name,avatar_url,is_admin')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('Unable to load user profile:', error);
        if (active) setProfile(data as Profile | null);
      })
      .catch((error: unknown) => {
        console.error('Unable to load user profile:', error);
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  const value = useMemo<AuthValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading: authLoading || profileLoading,
    configured: isSupabaseConfigured,
    authError,
    signOut: async () => {
      if (!supabase) return;

      const { error } = await supabase.auth.signOut();

      if (error) throw error;
    },
    signInWithGoogle: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');

      setAuthError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
    },
  }), [session, profile, authLoading, profileLoading, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) throw new Error('useAuth must be used inside AuthProvider');

  return context;
}
