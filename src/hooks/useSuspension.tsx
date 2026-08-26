import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface SuspensionStatus {
  is_suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
}

/**
 * Realtime suspension status for the current user.
 * Returns null when logged out / not suspended data loaded yet.
 */
export const useSuspension = (): SuspensionStatus | null => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SuspensionStatus | null>(null);

  useEffect(() => {
    if (!user) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_suspended, suspension_reason, suspended_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data) {
        setStatus({
          is_suspended: !!data.is_suspended,
          suspension_reason: data.suspension_reason ?? null,
          suspended_at: data.suspended_at ?? null,
        });
      }
    };

    load();

    // Live update when admin suspends / unsuspends
    const channel = supabase
      .channel(`suspension:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            is_suspended?: boolean;
            suspension_reason?: string | null;
            suspended_at?: string | null;
          };
          setStatus({
            is_suspended: !!row.is_suspended,
            suspension_reason: row.suspension_reason ?? null,
            suspended_at: row.suspended_at ?? null,
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return status;
};
