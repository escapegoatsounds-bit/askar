import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  loading: boolean;
  session: Session | null;
  email: string | null;
  role: 'owner' | 'editor' | null; // null = signed in but not invited
  refresh: () => void;
}

const Ctx = createContext<AuthState>({ loading: true, session: null, email: null, role: null, refresh: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'owner' | 'editor' | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const email = session?.user?.email?.toLowerCase() ?? null;

  useEffect(() => {
    let alive = true;
    if (!email) {
      setRole(null);
      // getSession resolves quickly; give it a moment before showing sign-in
      const t = setTimeout(() => alive && setLoading(false), 300);
      return () => {
        alive = false;
        clearTimeout(t);
      };
    }
    setLoading(true);
    supabase
      .from('members')
      .select('role')
      .eq('email', email)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setRole((data?.role as any) ?? null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [email, tick]);

  return <Ctx.Provider value={{ loading, session, email, role, refresh: () => setTick((t) => t + 1) }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
