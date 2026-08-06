import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export type WatchHistoryItem = {
  id: string;
  user_id: string;
  room_id: string | null;
  movie_title: string;
  movie_url: string | null;
  poster_url: string | null;
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
};

export function useWatchHistoryTracker({
  roomId,
  movieTitle,
  movieUrl,
  posterUrl,
  positionSeconds,
  durationSeconds,
  isPlaying,
}: {
  roomId?: string;
  movieTitle?: string | null;
  movieUrl?: string | null;
  posterUrl?: string | null;
  positionSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
}) {
  const { user } = useSession();
  const lastSavedRef = useRef<number>(0);

  useEffect(() => {
    if (!user || !movieTitle || !isPlaying) return;

    const now = Date.now();
    // Throttle database save to every 15 seconds
    if (now - lastSavedRef.current < 15000) return;
    lastSavedRef.current = now;

    void supabase.from("watch_history").upsert(
      {
        user_id: user.id,
        room_id: roomId || null,
        movie_title: movieTitle,
        movie_url: movieUrl || null,
        poster_url: posterUrl || null,
        position_seconds: Math.floor(positionSeconds),
        duration_seconds: Math.floor(durationSeconds),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,movie_title" },
    );
  }, [user, roomId, movieTitle, movieUrl, posterUrl, positionSeconds, durationSeconds, isPlaying]);
}
