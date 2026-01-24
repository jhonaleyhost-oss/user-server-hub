import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'free' | 'premium' | 'reseller' | 'admin';

interface UserRoleData {
  role: AppRole;
  loading: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  isReseller: boolean;
  refetch: () => Promise<void>;
}

export const useUserRole = (): UserRoleData => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole>('free');
  const [loading, setLoading] = useState(true);

  const fetchRole = async () => {
    if (!user) {
      setRole('free');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        setRole('free');
      } else {
        setRole((data?.role as AppRole) || 'free');
      }
    } catch (err) {
      console.error('Error:', err);
      setRole('free');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If auth is still loading, keep our loading state true
    if (authLoading) {
      setLoading(true);
      return;
    }
    
    // Auth finished loading - fetch role
    fetchRole();
  }, [user, authLoading]);

  // Only show loading while auth is loading OR while we're fetching the role
  // But once auth is done and we have no user, we're not loading
  const isLoading = authLoading || (user ? loading : false);

  return {
    role,
    loading: isLoading,
    isAdmin: role === 'admin',
    isPremium: role === 'premium' || role === 'reseller' || role === 'admin',
    isReseller: role === 'reseller' || role === 'admin',
    refetch: fetchRole,
  };
};
