import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Search, UserMinus, UserPlus, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "@/hooks/use-session";
import {
  fetchProfiles,
  listFriendships,
  removeFriendship,
  respondToFriendRequest,
  searchProfiles,
  sendFriendRequest,
  type PublicProfile,
} from "@/lib/friends";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({
    meta: [
      { title: "Friends — CineTogether" },
      {
        name: "description",
        content: "Add teammates as friends on CineTogether so you can invite them to watch rooms in one click.",
      },
      { property: "og:title", content: "Friends — CineTogether" },
      { property: "og:description", content: "Add teammates and invite them to synchronized watch rooms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});

function PersonRow({
  profile,
  children,
}: {
  profile: PublicProfile;
  children?: React.ReactNode;
}) {
  return (
    <li className="surface-panel flex items-center gap-3 rounded-xl p-3">
      <Avatar className="size-10 border border-border">
        <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="bg-secondary text-sm">
          {profile.display_name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{profile.display_name}</span>
      <div className="ml-auto flex shrink-0 gap-2">{children}</div>
    </li>
  );
}

function FriendsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const friendshipsQuery = useQuery({
    queryKey: ["friendships", user?.id],
    queryFn: () => listFriendships(user!.id),
    enabled: Boolean(user?.id),
  });

  const rows = useMemo(() => friendshipsQuery.data ?? [], [friendshipsQuery.data]);

  const relatedIds = useMemo(
    () => rows.map((r) => (r.requester_id === user?.id ? r.addressee_id : r.requester_id)),
    [rows, user?.id],
  );

  const profilesQuery = useQuery({
    queryKey: ["friend-related-profiles", relatedIds],
    queryFn: () => fetchProfiles(relatedIds),
    enabled: relatedIds.length > 0,
  });

  const profileById = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    for (const p of profilesQuery.data ?? []) map.set(p.id, p);
    return map;
  }, [profilesQuery.data]);

  const searchQuery = useQuery({
    queryKey: ["profile-search", submitted, user?.id],
    queryFn: () => searchProfiles(submitted, user!.id),
    enabled: Boolean(user?.id) && submitted.trim().length >= 2,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["friendships", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["friend-profiles", user?.id] });
  }

  const add = useMutation({
    mutationFn: (id: string) => sendFriendRequest(user!.id, id),
    onSuccess: () => {
      refresh();
      toast.success("Friend request sent");
    },
    onError: () => toast.error("You've already got a request with that person"),
  });

  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "declined" }) =>
      respondToFriendRequest(id, status),
    onSuccess: (_d, v) => {
      refresh();
      toast.success(v.status === "accepted" ? "Friend added" : "Request declined");
    },
    onError: () => toast.error("Couldn't update that request"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFriendship(id),
    onSuccess: () => {
      refresh();
      toast.success("Removed");
    },
    onError: () => toast.error("Couldn't remove that friend"),
  });

  const accepted = rows.filter((r) => r.status === "accepted");
  const incoming = rows.filter((r) => r.status === "pending" && r.addressee_id === user?.id);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === user?.id);
  const knownIds = new Set(relatedIds);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-5xl">Friends</h1>
        <p className="mt-2 text-muted-foreground">
          Add teammates once, then invite them to any room in a click.
        </p>

        <form
          className="surface-panel mt-8 flex flex-col gap-3 rounded-xl p-4 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(term);
          }}
        >
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search people by display name"
            aria-label="Search people by display name"
          />
          <Button type="submit" variant="secondary">
            <Search className="mr-2 size-4" /> Search
          </Button>
        </form>

        {submitted.trim().length >= 2 && (
          <section className="mt-6">
            <h2 className="text-2xl">Search results</h2>
            {searchQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : (searchQuery.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nobody matched that name.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(searchQuery.data ?? []).map((p) => (
                  <PersonRow key={p.id} profile={p}>
                    {knownIds.has(p.id) ? (
                      <Badge variant="secondary">Already connected</Badge>
                    ) : (
                      <Button size="sm" disabled={add.isPending} onClick={() => add.mutate(p.id)}>
                        <UserPlus className="mr-2 size-4" /> Add
                      </Button>
                    )}
                  </PersonRow>
                ))}
              </ul>
            )}
          </section>
        )}

        {incoming.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl">Requests for you</h2>
            <ul className="mt-3 space-y-2">
              {incoming.map((r) => {
                const p = profileById.get(r.requester_id);
                if (!p) return null;
                return (
                  <PersonRow key={r.id} profile={p}>
                    <Button
                      size="sm"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: r.id, status: "accepted" })}
                    >
                      <Check className="mr-1 size-4" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: r.id, status: "declined" })}
                    >
                      <X className="size-4" />
                    </Button>
                  </PersonRow>
                );
              })}
            </ul>
          </section>
        )}

        {outgoing.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl">Sent requests</h2>
            <ul className="mt-3 space-y-2">
              {outgoing.map((r) => {
                const p = profileById.get(r.addressee_id);
                if (!p) return null;
                return (
                  <PersonRow key={r.id} profile={p}>
                    <Badge variant="outline">Pending</Badge>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
                      Cancel
                    </Button>
                  </PersonRow>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-3xl">Your friends</h2>
          {friendshipsQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : accepted.length === 0 ? (
            <p className="mt-3 text-muted-foreground">
              No friends yet. Search above to send your first request.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {accepted.map((r) => {
                const otherId = r.requester_id === user?.id ? r.addressee_id : r.requester_id;
                const p = profileById.get(otherId);
                if (!p) return null;
                return (
                  <PersonRow key={r.id} profile={p}>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
                      <UserMinus className="mr-1 size-4" /> Remove
                    </Button>
                  </PersonRow>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
