import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

/**
 * Tracks which users are currently online using Supabase Realtime Presence.
 * Each authenticated user joins a shared "online-users" channel and tracks their presence.
 * Returns a Set of user IDs that are currently online.
 */
export function useOnlinePresence() {
  const { user } = useSession();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineUserIds(new Set(Object.keys(state)));
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ userId: user.id, online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { onlineUserIds };
}
