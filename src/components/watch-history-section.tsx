import { useQuery } from "@tanstack/react-query";
import { Film, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { WatchHistoryItem } from "@/hooks/use-watch-history";

export function WatchHistorySection() {
  const { user } = useSession();

  const { data: history = [] } = useQuery({
    queryKey: ["watch-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("watch_history")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(10);
      return (data ?? []) as WatchHistoryItem[];
    },
    enabled: Boolean(user),
  });

  if (history.length === 0) return null;

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center gap-2">
        <Film className="size-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tight">Continue Watching</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {history.map((item) => {
          const progressPercent = item.duration_seconds > 0
            ? Math.min(100, Math.round((item.position_seconds / item.duration_seconds) * 100))
            : 0;

          return (
            <div key={item.id} className="surface-panel overflow-hidden rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base line-clamp-1">{item.movie_title}</h3>
                <Button size="xs" variant="secondary" className="gap-1">
                  <Play className="size-3" /> Resume
                </Button>
              </div>

              {item.duration_seconds > 0 && (
                <div className="space-y-1">
                  <Progress value={progressPercent} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground text-right">{progressPercent}% watched</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
