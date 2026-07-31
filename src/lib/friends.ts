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

/** Invitee ids already invited to a room (any status). */
export async function listRoomInviteeIds(roomId: string) {
  const { data, error } = await supabase.from("room_invites").select("invitee_id").eq("room_id", roomId);
  if (error) throw error;
  return (data ?? []).map((r) => r.invitee_id);
}
