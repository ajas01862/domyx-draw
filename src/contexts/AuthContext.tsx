
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile } from '../types';

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const authEventReceived = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        authEventReceived.current = true;

        if (active) {
          setSession(nextSession);
          setAuthLoading(false);
        }
      },
    );

    const restoreSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (active && !authEventReceived.current) {
          setSession(data.session);
        }
      } catch (error) {
        console.error('Session restoration failed:', error);

        if (active && !authEventReceived.current) {
          setSession(null);
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    void restoreSession();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
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

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id,username,full_name,avatar_url,is_admin')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) throw error;

        if (active) {
          setProfile(data as Profile | null);
        }
      } catch (error) {
        console.error('Profile loading failed:', error);

        if (active) setProfile(null);
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [session]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading: authLoading || profileLoading,
      configured: isSupabaseConfigured,

      signOut: async () => {
        if (!supabase) return;

        const { error } = await supabase.auth.signOut();

        if (error) throw error;
      },

      signInWithGoogle: async () => {
        if (!supabase) {
          throw new Error('Supabase is not configured.');
        }

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
            queryParams: {
              prompt: 'select_account',
            },
          },
        });

        if (error) throw error;
      },
    }),
    [session, profile, authLoading, profileLoading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
