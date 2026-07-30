import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — CineTogether" },
      { name: "description", content: "Update the display name and bio your co-watchers see in CineTogether rooms." },
      { property: "og:title", content: "Your profile — CineTogether" },
      { property: "og:description", content: "Update how you appear in CineTogether watch rooms." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useSession();
  const { data: profile, isLoading } = useProfile(user?.id);
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    const name = displayName.trim().slice(0, 40);
    if (!name) return toast.error("Display name can't be empty");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, bio: bio.trim().slice(0, 280) || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error("Couldn't save your profile");
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Profile updated");
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="text-5xl">Your profile</h1>
        <p className="mt-2 text-muted-foreground">This is how you appear in watch rooms.</p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="surface-panel mt-8 space-y-4 rounded-xl p-6">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                maxLength={40}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                maxLength={280}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Favourite genre, go-to snack…"
              />
            </div>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
