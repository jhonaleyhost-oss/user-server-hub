import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';

/**
 * Guards admin-only routes.
 * - Waits for auth + role to finish loading (never renders children early).
 * - Re-validates admin status server-side via the `is_admin` RPC (defense in depth
 *   in case the cached role in user_roles is stale or tampered with client-side).
 * - Redirects to /auth when not signed in, and to / when signed in but not admin.
 */
export const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [verifying, setVerifying] = useState(true);
  const [serverAdmin, setServerAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (authLoading || roleLoading) return;

      if (!user) {
        if (!cancelled) {
          setServerAdmin(false);
          setVerifying(false);
        }
        return;
      }

      // Re-validate against the database using the security-definer function.
      // This ensures the client cannot bypass the gate by mutating local state.
      try {
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        if (cancelled) return;
        if (error) {
          console.error('Admin verification failed:', error);
          setServerAdmin(false);
        } else {
          setServerAdmin(Boolean(data));
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Admin verification error:', err);
        setServerAdmin(false);
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [authLoading, roleLoading, user]);

  // Block rendering while we don't yet know the answer.
  if (authLoading || roleLoading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card rounded-2xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground mt-4 text-sm">Memverifikasi akses admin...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Require BOTH the local role hook AND the server check to pass.
  if (!isAdmin || serverAdmin !== true) {
    toast({
      variant: 'destructive',
      title: 'Akses Ditolak',
      description: 'Halaman ini hanya untuk admin.',
    });
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;