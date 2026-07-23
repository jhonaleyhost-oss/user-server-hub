import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PresenceCtx {
  onlineCount: number;
  onlineUserIds: string[];
}

const Ctx = createContext<PresenceCtx>({ onlineCount: 0, onlineUserIds: [] });

export const OnlinePresenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<PresenceCtx>({ onlineCount: 0, onlineUserIds: [] });

  useEffect(() => {
    if (!user) {
      setState({ onlineCount: 0, onlineUserIds: [] });
      return;
    }
    const channel = supabase.channel("global-presence", {
      config: { presence: { key: user.id } },
    });

    const sync = () => {
      const s = channel.presenceState() as Record<string, unknown[]>;
      const ids = Object.keys(s);
      setState({ onlineCount: ids.length, onlineUserIds: ids });
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
};

export const useOnlinePresence = () => useContext(Ctx);