import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ChatMuteStatus {
  muted: boolean;
  muted_until: string | null;
  permanent: boolean;
  reason: string | null;
  strikes: number;
}

const EMPTY: ChatMuteStatus = {
  muted: false,
  muted_until: null,
  permanent: false,
  reason: null,
  strikes: 0,
};

/** Tracks the current user's Chat Global mute status (realtime + auto expiry). */
export const useChatMute = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ChatMuteStatus>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setStatus(EMPTY);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_my_chat_mute" as any);
    if (error) {
      setLoading(false);
      return;
    }
    const row = Array.isArray(data) ? (data[0] as ChatMuteStatus | undefined) : undefined;
    setStatus(row ?? EMPTY);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Realtime: react instantly when an admin mutes / unmutes this user
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chat-mute-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_mutes", filter: `user_id=eq.${user.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  // Auto-clear when the mute expires
  useEffect(() => {
    if (!status.muted || !status.muted_until) return;
    const ms = new Date(status.muted_until).getTime() - Date.now();
    if (ms <= 0) {
      refetch();
      return;
    }
    const t = setTimeout(() => refetch(), Math.min(ms + 500, 60000));
    return () => clearTimeout(t);
  }, [status, refetch]);

  return { status, loading, refetch };
};
