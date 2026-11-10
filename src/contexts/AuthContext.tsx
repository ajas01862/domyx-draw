import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile } from '../types';

type AuthValue = { session: Session | null; user: User | null; profile: Profile | null; loading: boolean; configured: boolean; signOut: () => Promise<void>; signInWithGoogle: () => Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!supabase || !session?.user) { setProfile(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    supabase.from('profiles').select('id,username,full_name,avatar_url,is_admin').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if (active) { setProfile(data as Profile | null); setLoading(false); }
    });
    return () => { active = false; };
  }, [session]);
  const value = useMemo<AuthValue>(() => ({
    session, user: session?.user ?? null, profile, loading, configured: isSupabaseConfigured,
    signOut: async () => { if (supabase) await supabase.auth.signOut(); },
    signInWithGoogle: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      if (error) throw error;
    },
  }), [session, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
