import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import type { Tables } from "@/integrations/supabase/types";

export type NotificationRow = Tables<"notifications">;

export type NotificationItem = {
  id: string;
  type: string;
  senderId: string | null;
  referenceId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
};

export function useNotifications() {
  const { user } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    // Query persistent notifications table
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[Notifications] Failed to load:", error);
      return;
    }

    const rows = data ?? [];

    // Resolve sender profiles for richer display
    const senderIds = [...new Set(rows.map((r) => r.sender_id).filter(Boolean))] as string[];
    let profileMap = new Map<string, { display_name: string; avatar_url: string | null }>();

    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", senderIds);

      for (const p of profiles ?? []) {
        profileMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
      }
    }

    const items: NotificationItem[] = rows.map((r) => {
      const sender = r.sender_id ? profileMap.get(r.sender_id) : undefined;
      return {
        id: r.id,
        type: r.type,
        senderId: r.sender_id,
        referenceId: r.reference_id,
        message: r.message,
        isRead: r.is_read,
        createdAt: r.created_at,
        senderName: sender?.display_name,
        senderAvatar: sender?.avatar_url ?? undefined,
      };
    });

    setNotifications(items);
    setUnreadCount(items.filter((n) => !n.isRead).length);
  }, [user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // Subscribe to new notifications via Realtime CDC
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          // Show instant toast
          if (row.type === "friend_request") {
            toast.info("🔔 " + row.message, { duration: 5000 });
          } else if (row.type === "friend_request_accepted") {
            toast.success("🎉 " + row.message, { duration: 5000 });
          } else if (row.type === "room_invitation") {
            toast.info("📨 " + row.message, { duration: 5000 });
          }
          // Reload full list to get sender profile info
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, [user]);

  return { notifications, unreadCount, markAsRead, markAllRead, reload: loadNotifications };
}
