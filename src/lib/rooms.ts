import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Room = Tables<"rooms">;
export type RoomMember = Tables<"room_members">;
export type Message = Tables<"messages">;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function listPublicRooms() {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function createRoom(input: {
  name: string;
  description?: string;
  isPrivate: boolean;
  movieTitle?: string;
  movieUrl?: string;
  hostId: string;
}) {
  const code = generateRoomCode();
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      code,
      name: input.name,
      description: input.description || null,
      is_private: input.isPrivate,
      movie_title: input.movieTitle || null,
      movie_url: input.movieUrl || null,
      host_id: input.hostId,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from("room_members").insert({ room_id: data.id, user_id: input.hostId });
  return data;
}

/** Joins by invite code, including private rooms (security-definer RPC). */
export async function joinRoomByCode(code: string) {
  const { data, error } = await supabase.rpc("join_room_by_code", { _code: code });
  if (error) throw error;
  return data as string;
}

export async function fetchRoomByCode(code: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProfilesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);
  if (error) throw error;
  return data;
}

/** Builds the shareable join link for a room code. */
export function roomInviteLink(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/room/${code.toUpperCase()}`;
}

/** Posts an invite link into the room chat so anyone reading can join in one click. */
export async function postInviteMessage(input: {
  roomId: string;
  userId: string;
  code: string;
  note?: string;
}) {
  const body = JSON.stringify({
    code: input.code.toUpperCase(),
    url: roomInviteLink(input.code),
    note: input.note ?? null,
  });
  const { error } = await supabase
    .from("messages")
    .insert({ room_id: input.roomId, user_id: input.userId, body, kind: "invite" });
  if (error) throw error;
}

export type InvitePayload = { code: string; url: string; note: string | null };

export function parseInviteBody(body: string): InvitePayload | null {
  try {
    const parsed = JSON.parse(body) as Partial<InvitePayload>;
    if (!parsed?.code || !parsed?.url) return null;
    return { code: parsed.code, url: parsed.url, note: parsed.note ?? null };
  } catch {
    return null;
  }
}

/** Uploaded movies live in a private bucket; playback needs a signed URL. */
export async function resolveMovieUrl(movieUrl: string | null) {
  if (!movieUrl) return null;
  if (!movieUrl.startsWith("storage:")) return movieUrl;
  const path = movieUrl.slice("storage:".length);
  const { data } = await supabase.storage.from("movies").createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}
