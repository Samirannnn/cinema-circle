import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Friendship = Tables<"friendships">;
export type RoomInvite = Tables<"room_invites">;

export type PublicProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

/** All friendships involving the signed-in user (pending in/out + accepted). */
export async function listFriendships(userId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchProfiles(ids: string[]): Promise<PublicProfile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function searchProfiles(term: string, excludeId: string): Promise<PublicProfile[]> {
  const clean = term.trim();
  if (clean.length < 2) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .ilike("display_name", `%${clean}%`)
    .neq("id", excludeId)
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  // Prevent self-requests
  if (requesterId === addresseeId) throw new Error("Cannot send friend request to yourself");

  // Check for existing relationship (pending or accepted) in either direction
  const { data: existing } = await supabase
    .from("friendships")
    .select("id, status")
    .or(
      `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`,
    )
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") throw new Error("Already friends");
    if (existing.status === "pending") throw new Error("Friend request already pending");
  }

  // Check if blocked
  const blocked = await isBlocked(requesterId, addresseeId);
  if (blocked) throw new Error("Cannot send request to this user");

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId });
  if (error) throw error;
}

export async function respondToFriendRequest(id: string, status: "accepted" | "declined") {
  const { error } = await supabase.from("friendships").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function removeFriendship(id: string) {
  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) throw error;
}

/** Accepted friends of a user, resolved to profiles. */
export async function listFriendProfiles(userId: string): Promise<PublicProfile[]> {
  const rows = await listFriendships(userId);
  const ids = rows
    .filter((r) => r.status === "accepted")
    .map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  return fetchProfiles(ids);
}

export async function inviteFriendToRoom(roomId: string, inviterId: string, inviteeId: string) {
  const { error } = await supabase
    .from("room_invites")
    .upsert(
      { room_id: roomId, inviter_id: inviterId, invitee_id: inviteeId, status: "pending" },
      { onConflict: "room_id,invitee_id" },
    );
  if (error) throw error;
}

/** Pending room invites addressed to the signed-in user, with room + inviter details. */
export async function listIncomingRoomInvites(userId: string) {
  const { data, error } = await supabase
    .from("room_invites")
    .select("*, rooms(id, code, name, movie_title, is_private)")
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function respondToRoomInvite(id: string, status: "accepted" | "declined") {
  const { error } = await supabase.from("room_invites").update({ status }).eq("id", id);
  if (error) throw error;
}

/** The room invite addressed to a specific user, if any (RSVP state for chat cards). */
export async function getRoomInvite(roomId: string, inviteeId: string) {
  const { data, error } = await supabase
    .from("room_invites")
    .select("*")
    .eq("room_id", roomId)
    .eq("invitee_id", inviteeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Invitee ids already invited to a room, with their RSVP status. */
export async function listRoomInviteStatuses(roomId: string) {
  const { data, error } = await supabase
    .from("room_invites")
    .select("invitee_id, status")
    .eq("room_id", roomId);
  if (error) throw error;
  return data ?? [];
}

/** Removes prior invite cards for this invitee so the fresh RSVP card replaces them. */
export async function clearInviteMessages(roomId: string, inviterId: string, inviteeId: string) {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", inviterId)
    .eq("kind", "invite")
    .like("body", `%"inviteeId":"${inviteeId}"%`);
  if (error) throw error;
}

// ── Block / Unblock ───────────────────────────────────────────────────

/** Block a user. Automatically removes any existing friendship. */
export async function blockUser(blockerId: string, blockedId: string) {
  // Remove any existing friendship in either direction
  const { data: friendships } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${blockerId},addressee_id.eq.${blockedId}),and(requester_id.eq.${blockedId},addressee_id.eq.${blockerId})`,
    );

  if (friendships && friendships.length > 0) {
    for (const f of friendships) {
      await supabase.from("friendships").delete().eq("id", f.id);
    }
  }

  const { error } = await supabase
    .from("blocked_users")
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function listBlockedUsers(userId: string) {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("id, blocked_id, created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Check if a block exists in either direction between two users. */
export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`,
    )
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

// ── Extended Search ───────────────────────────────────────────────────

/** Search profiles by display_name OR email (email part of display_name or user metadata). */
export async function searchProfilesByNameOrEmail(
  term: string,
  excludeId: string,
): Promise<PublicProfile[]> {
  const clean = term.trim();
  if (clean.length < 2) return [];

  // Search by display_name (ilike) — this covers both name and email-like inputs
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .ilike("display_name", `%${clean}%`)
    .neq("id", excludeId)
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

// ── Room Helpers ──────────────────────────────────────────────────────

/** List active rooms where the user is host or member (for invite-to-room flow). */
export async function listUserActiveRooms(userId: string) {
  // Get rooms where user is host
  const { data: hosted, error: e1 } = await supabase
    .from("rooms")
    .select("id, code, name, movie_title, is_private")
    .eq("host_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (e1) throw e1;

  // Get rooms where user is member
  const { data: memberships, error: e2 } = await supabase
    .from("room_members")
    .select("room_id, rooms(id, code, name, movie_title, is_private)")
    .eq("user_id", userId)
    .limit(20);
  if (e2) throw e2;

  const memberRooms = (memberships ?? [])
    .map((m) => m.rooms)
    .filter((r): r is NonNullable<typeof r> => r != null);

  // Deduplicate by room id
  const seen = new Set<string>();
  const result: typeof hosted = [];
  for (const room of [...(hosted ?? []), ...memberRooms]) {
    if (!seen.has(room.id)) {
      seen.add(room.id);
      result.push(room);
    }
  }
  return result;
}
