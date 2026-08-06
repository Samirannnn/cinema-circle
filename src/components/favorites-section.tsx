import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";

export type FavoriteItem = {
  id: string;
  user_id: string;
  movie_title: string;
  movie_url: string | null;
  poster_url: string | null;
  created_at: string;
};

export function FavoritesSection() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("favorites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as FavoriteItem[];
    },
    enabled: Boolean(user),
  });

  async function removeFavorite(id: string) {
    const { error } = await supabase.from("favorites").delete().eq("id", id);
    if (error) return toast.error("Failed to remove favorite.");
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
    toast.success("Removed from favorites.");
  }

  if (favorites.length === 0) return null;

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center gap-2">
        <Heart className="size-5 text-rose-500 fill-rose-500" />
        <h2 className="text-xl font-bold tracking-tight">Favorite Movies</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favorites.map((fav) => (
          <div key={fav.id} className="surface-panel flex items-center justify-between rounded-xl border border-border/60 p-4">
            <span className="font-semibold text-sm line-clamp-1">{fav.movie_title}</span>
            <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => void removeFavorite(fav.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
