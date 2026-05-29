import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pwd_recovery') === '1';
  });
  const forceLogoutInProgress = useRef(false);

  useEffect(() => {
    // If a previous recovery flow was started but never completed
    // (e.g. user closed the tab), force sign-out on app load unless
    // we're back on the reset page to finish it.
    const pending = localStorage.getItem('pwd_recovery') === '1';
    if (pending && window.location.pathname !== '/reset-password') {
      localStorage.removeItem('pwd_recovery');
      supabase.auth.signOut().catch(() => {});
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          localStorage.setItem('pwd_recovery', '1');
          setIsRecovery(true);
          if (typeof window !== 'undefined' && window.location.pathname !== '/reset-password') {
            window.location.replace('/reset-password');
          }
        }
        if (session) {
          forceLogoutInProgress.current = false;
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        forceLogoutInProgress.current = false;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Detect deleted/disabled accounts and force sign-out
  useEffect(() => {
    if (!session || isRecovery) return;

    const forceLogout = async () => {
      if (forceLogoutInProgress.current) return;
      forceLogoutInProgress.current = true;

      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      setSession(null);

      if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
        window.location.replace('/auth');
      }
    };

    const checkUserExists = async () => {
      try {
        const [{ data: authData, error: authError }, { data: profileData, error: profileError }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from('profiles')
            .select('user_id')
            .eq('user_id', session.user.id)
            .maybeSingle(),
        ]);

        const msg = (authError?.message || '').toLowerCase();
        const deleted =
          !!authError &&
          (msg.includes('user_not_found') ||
            msg.includes('user not found') ||
            msg.includes('user from sub claim') ||
            msg.includes('invalid') ||
            msg.includes('jwt'));

        const missingProfile = !profileError && !profileData;
        const missingAuthUser = !!authError || !authData?.user;

        if (deleted || missingAuthUser || missingProfile) {
          await forceLogout();
        }
      } catch {
        // ignore network errors
      }
    };

    // Check immediately, on window focus, and every 30s
    checkUserExists();
    const onFocus = () => checkUserExists();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(checkUserExists, 30000);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [session?.user?.id, isRecovery]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      // Generate device fingerprint
      let fingerprint = '';
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        fingerprint = result.visitorId;
      } catch (fpErr) {
        console.warn('Fingerprint generation failed:', fpErr);
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ email, password, fullName, fingerprint }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return { error: new Error(data.error || 'Gagal mendaftar') };
      }

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Gagal mendaftar') };
    }
  };

  const signOut = async () => {
    // Always clear local state regardless of server response
    forceLogoutInProgress.current = false;
    localStorage.removeItem('pwd_recovery');
    setIsRecovery(false);
    setUser(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore errors - session might already be expired
      console.log('Sign out completed');
    }
  };

  return (
    <AuthContext.Provider value={{
      user: isRecovery ? null : user,
      session: isRecovery ? null : session,
      loading,
      isRecovery,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
