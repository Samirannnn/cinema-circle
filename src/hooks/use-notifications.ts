import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export type NotificationItem = {
  id: string;
  type: "friend_request" | "room_invite";
  title: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, any>;
};

export function useNotifications() {
  const { user } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Load initial pending friend requests & room invites
    const loadInitial = async () => {
      const items: NotificationItem[] = [];

      // Pending friend requests
      const { data: requests } = await supabase
        .from("friendships")
        .select("id, requester_id, created_at")
        .eq("addressee_id", user.id)
        .eq("status", "pending");

      if (requests && requests.length > 0) {
        requests.forEach((req) => {
          items.push({
            id: req.id,
            type: "friend_request",
            title: "Friend Request",
            message: "You have a pending friend request",
            createdAt: req.created_at,
            metadata: { requesterId: req.requester_id },
          });
        });
      }

      // Pending room invites
      const { data: invites } = await supabase
        .from("room_invites")
        .select("id, inviter_id, room_id, created_at")
        .eq("invitee_id", user.id)
        .eq("status", "pending");

      if (invites && invites.length > 0) {
        invites.forEach((inv) => {
          items.push({
            id: inv.id,
            type: "room_invite",
            title: "Room Invitation",
            message: "You have been invited to join a watch room",
            createdAt: inv.created_at,
            metadata: { roomId: inv.room_id, inviterId: inv.inviter_id },
          });
        });
      }

      setNotifications(items);
      setUnreadCount(items.length);
    };

    void loadInitial();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${user.id}`,
        },
        () => {
          toast.info("You received a new friend request!");
          void loadInitial();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_invites",
          filter: `invitee_id=eq.${user.id}`,
        },
        () => {
          toast.info("You received a new watch room invitation!");
          void loadInitial();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllRead = () => {
    setUnreadCount(0);
  };

  return { notifications, unreadCount, markAllRead };
}
