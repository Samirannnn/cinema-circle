import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
  });
}

/** Avatars live in a private bucket, so links are signed on demand. */
export async function signedAvatarUrl(path: string) {
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}
