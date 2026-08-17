import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  Check,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldOff,
  Tv,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/hooks/use-session";
import { useOnlinePresence } from "@/hooks/use-online-presence";
import { InviteToRoomDialog } from "@/components/invite-to-room-dialog";
import { VoiceChatButton } from "@/components/voice-chat-button";
import { VideoCallButton } from "@/components/video-call-button";
import {
  blockUser,
  fetchProfiles,
  listBlockedUsers,
  listFriendships,
  removeFriendship,
  respondToFriendRequest,
  searchProfilesByNameOrEmail,
  sendFriendRequest,
  unblockUser,
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

// ── Friend Card (rich UI with online indicator + actions) ───────────

function FriendCard({
  profile,
  isOnline,
  onRemove,
  onBlock,
  onInviteToRoom,
}: {
  profile: PublicProfile;
  isOnline: boolean;
  onRemove: () => void;
  onBlock: () => void;
  onInviteToRoom: () => void;
}) {
  return (
    <div className="surface-panel flex flex-col gap-3 rounded-xl border border-border/60 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="size-12 border border-border">
            <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-secondary text-sm">
              {profile.display_name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background ${
              isOnline ? "bg-emerald-500" : "bg-zinc-400"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{profile.display_name}</div>
          <div className="text-xs text-muted-foreground">{isOnline ? "🟢 Online" : "⚪ Offline"}</div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRemove}>
              <UserMinus className="mr-2 size-4" /> Remove Friend
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onBlock} className="text-destructive focus:text-destructive">
              <Ban className="mr-2 size-4" /> Block User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onInviteToRoom}>
          <Tv className="mr-1.5 size-3.5" /> Invite to Room
        </Button>
        <VoiceChatButton disabled />
        <VideoCallButton friendId={profile.id} friendName={profile.display_name} disabled />
      </div>
    </div>
  );
}

// ── Person Row (for search results & requests) ──────────────────────

function PersonRow({
  profile,
  isOnline,
  children,
}: {
  profile: PublicProfile;
  isOnline?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="surface-panel flex items-center gap-3 rounded-xl p-3">
      <div className="relative">
        <Avatar className="size-10 border border-border">
          <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-secondary text-sm">
            {profile.display_name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {isOnline !== undefined && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ${
              isOnline ? "bg-emerald-500" : "bg-zinc-400"
            }`}
          />
        )}
      </div>
      <span className="truncate">{profile.display_name}</span>
      <div className="ml-auto flex shrink-0 gap-2">{children}</div>
    </li>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

function FriendsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { onlineUserIds } = useOnlinePresence();
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string } | null>(null);

  // ── Queries ──

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
    queryFn: () => searchProfilesByNameOrEmail(submitted, user!.id),
    enabled: Boolean(user?.id) && submitted.trim().length >= 2,
  });

  const blockedQuery = useQuery({
    queryKey: ["blocked-users", user?.id],
    queryFn: () => listBlockedUsers(user!.id),
    enabled: Boolean(user?.id),
  });

  const blockedIds = useMemo(
    () => new Set((blockedQuery.data ?? []).map((b) => b.blocked_id)),
    [blockedQuery.data],
  );

  const blockedProfiles = useQuery({
    queryKey: ["blocked-profiles", [...blockedIds]],
    queryFn: () => fetchProfiles([...blockedIds]),
    enabled: blockedIds.size > 0,
  });

  // ── Mutations ──

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["friendships", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["friend-profiles", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["blocked-users", user?.id] });
  }

  const add = useMutation({
    mutationFn: (id: string) => sendFriendRequest(user!.id, id),
    onSuccess: () => {
      refresh();
      toast.success("Friend request sent!");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't send that request"),
  });

  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "declined" }) =>
      respondToFriendRequest(id, status),
    onSuccess: (_d, v) => {
      refresh();
      toast.success(v.status === "accepted" ? "🎉 Friend added!" : "Request declined");
    },
    onError: () => toast.error("Couldn't update that request"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFriendship(id),
    onSuccess: () => {
      refresh();
      toast.success("Friend removed");
    },
    onError: () => toast.error("Couldn't remove that friend"),
  });

  const block = useMutation({
    mutationFn: (blockedId: string) => blockUser(user!.id, blockedId),
    onSuccess: () => {
      refresh();
      toast.success("User blocked");
    },
    onError: () => toast.error("Couldn't block that user"),
  });

  const unblock = useMutation({
    mutationFn: (blockedId: string) => unblockUser(user!.id, blockedId),
    onSuccess: () => {
      refresh();
      toast.success("User unblocked");
    },
    onError: () => toast.error("Couldn't unblock that user"),
  });

  // ── Derived lists ──

  const accepted = rows.filter((r) => r.status === "accepted");
  const incoming = rows.filter((r) => r.status === "pending" && r.addressee_id === user?.id);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === user?.id);
  const knownIds = new Set(relatedIds);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-4xl sm:text-5xl">Friends</h1>
        <p className="mt-2 text-muted-foreground">
          Add teammates once, then invite them to any room in a click.
        </p>

        {/* Mobile-responsive tabs */}
        <Tabs defaultValue="friends" className="mt-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">
              Friends {accepted.length > 0 && `(${accepted.length})`}
            </TabsTrigger>
            <TabsTrigger value="requests">
              Requests{" "}
              {incoming.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 p-0 text-[10px]">
                  {incoming.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          {/* ── FRIENDS TAB ── */}
          <TabsContent value="friends" className="mt-6">
            {friendshipsQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : accepted.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No friends yet. Switch to the <strong>Search</strong> tab to find teammates.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {accepted.map((r) => {
                  const otherId = r.requester_id === user?.id ? r.addressee_id : r.requester_id;
                  const p = profileById.get(otherId);
                  if (!p) return null;
                  return (
                    <FriendCard
                      key={r.id}
                      profile={p}
                      isOnline={onlineUserIds.has(p.id)}
                      onRemove={() => remove.mutate(r.id)}
                      onBlock={() => block.mutate(p.id)}
                      onInviteToRoom={() => setInviteTarget({ id: p.id, name: p.display_name })}
                    />
                  );
                })}
              </div>
            )}

            {/* Blocked users section */}
            {blockedIds.size > 0 && (
              <div className="mt-10">
                <h3 className="text-lg font-semibold text-muted-foreground">Blocked Users</h3>
                <ul className="mt-3 space-y-2">
                  {(blockedProfiles.data ?? []).map((p) => (
                    <PersonRow key={p.id} profile={p}>
                      <Badge variant="outline" className="text-destructive border-destructive/30">
                        Blocked
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => unblock.mutate(p.id)}
                        disabled={unblock.isPending}
                      >
                        <ShieldOff className="mr-1 size-4" /> Unblock
                      </Button>
                    </PersonRow>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          {/* ── REQUESTS TAB ── */}
          <TabsContent value="requests" className="mt-6 space-y-8">
            {/* Incoming */}
            <section>
              <h2 className="text-xl font-semibold">Incoming Requests</h2>
              {incoming.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No incoming requests.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {incoming.map((r) => {
                    const p = profileById.get(r.requester_id);
                    if (!p) return null;
                    return (
                      <PersonRow key={r.id} profile={p} isOnline={onlineUserIds.has(p.id)}>
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
              )}
            </section>

            {/* Outgoing */}
            <section>
              <h2 className="text-xl font-semibold">Sent Requests</h2>
              {outgoing.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No pending sent requests.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {outgoing.map((r) => {
                    const p = profileById.get(r.addressee_id);
                    if (!p) return null;
                    return (
                      <PersonRow key={r.id} profile={p} isOnline={onlineUserIds.has(p.id)}>
                        <Badge variant="outline">Pending</Badge>
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
                          Cancel
                        </Button>
                      </PersonRow>
                    );
                  })}
                </ul>
              )}
            </section>
          </TabsContent>

          {/* ── SEARCH TAB ── */}
          <TabsContent value="search" className="mt-6">
            <form
              className="surface-panel flex flex-col gap-3 rounded-xl p-4 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(term);
              }}
            >
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search by display name or email"
                aria-label="Search by display name or email"
              />
              <Button type="submit" variant="secondary">
                <Search className="mr-2 size-4" /> Search
              </Button>
            </form>

            {submitted.trim().length >= 2 && (
              <section className="mt-6">
                <h2 className="text-xl font-semibold">Search Results</h2>
                {searchQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                ) : (searchQuery.data ?? []).length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Nobody matched that search.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {(searchQuery.data ?? []).map((p) => (
                      <PersonRow key={p.id} profile={p} isOnline={onlineUserIds.has(p.id)}>
                        {blockedIds.has(p.id) ? (
                          <Badge variant="outline" className="text-destructive border-destructive/30">
                            Blocked
                          </Badge>
                        ) : knownIds.has(p.id) ? (
                          <Badge variant="secondary">Already connected</Badge>
                        ) : (
                          <Button
                            size="sm"
                            disabled={add.isPending}
                            onClick={() => add.mutate(p.id)}
                          >
                            <UserPlus className="mr-2 size-4" /> Add Friend
                          </Button>
                        )}
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Invite-to-Room Dialog */}
      {inviteTarget && (
        <InviteToRoomDialog
          open={!!inviteTarget}
          onOpenChange={(open) => !open && setInviteTarget(null)}
          friendId={inviteTarget.id}
          friendName={inviteTarget.name}
        />
      )}
    </div>
  );
}
