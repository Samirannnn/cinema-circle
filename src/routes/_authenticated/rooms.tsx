import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Globe, Loader2, Plus, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { createRoom, fetchRoomByCode, joinRoomByCode, listPublicRooms } from "@/lib/rooms";
import { listIncomingRoomInvites, respondToRoomInvite } from "@/lib/friends";


export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: "Watch rooms — CineTogether" },
      { name: "description", content: "Browse public watch rooms, join with a code, or host your own synchronized screening." },
      { property: "og:title", content: "Watch rooms — CineTogether" },
      { property: "og:description", content: "Browse public watch rooms or host your own synchronized screening." },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    isPrivate: false,
    movieTitle: "",
    movieUrl: "",
  });

  const roomsQuery = useQuery({ queryKey: ["rooms"], queryFn: listPublicRooms });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!form.name.trim()) throw new Error("Give your room a name");
      return createRoom({
        name: form.name.trim().slice(0, 80),
        description: form.description.trim().slice(0, 280),
        isPrivate: form.isPrivate,
        movieTitle: form.movieTitle.trim().slice(0, 120),
        movieUrl: form.movieUrl.trim(),
        hostId: user.id,
      });
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setOpen(false);
      navigate({ to: "/room/$code", params: { code: room.code } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const join = useMutation({
    mutationFn: async (raw: string) => {
      const clean = raw.trim().toUpperCase();
      if (clean.length !== 6) throw new Error("Invite codes are 6 characters");
      await joinRoomByCode(clean);
      const room = await fetchRoomByCode(clean);
      if (!room) throw new Error("Room not found");
      return room;
    },
    onSuccess: (room) => navigate({ to: "/room/$code", params: { code: room.code } }),
    onError: (e: Error) => toast.error(e.message === "Room not found" ? "No room with that code" : e.message),
  });

  const invitesQuery = useQuery({
    queryKey: ["room-invites", user?.id],
    queryFn: () => listIncomingRoomInvites(user!.id),
    enabled: Boolean(user?.id),
  });

  const respondInvite = useMutation({
    mutationFn: async (v: { id: string; status: "accepted" | "declined"; code: string | null }) => {
      await respondToRoomInvite(v.id, v.status);
      return v;
    },
    onSuccess: (v) => {
      queryClient.invalidateQueries({ queryKey: ["room-invites", user?.id] });
      if (v.status === "accepted" && v.code) {
        navigate({ to: "/room/$code", params: { code: v.code } });
      }
    },
    onError: () => toast.error("Couldn't update that invite"),
  });

  const invites = useMemo(() => invitesQuery.data ?? [], [invitesQuery.data]);
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);


  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-5xl">Watch rooms</h1>
            <p className="mt-2 text-muted-foreground">
              Join a public screening, enter an invite code, or start your own.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="glow">
                <Plus className="mr-2 size-4" /> New room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a watch room</DialogTitle>
                <DialogDescription>
                  You'll be the host: you control playback and can invite others with a code.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room-name">Room name</Label>
                  <Input
                    id="room-name"
                    value={form.name}
                    maxLength={80}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Friday night sci-fi"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="room-desc">Description</Label>
                  <Textarea
                    id="room-desc"
                    value={form.description}
                    maxLength={280}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movie-title">Movie title</Label>
                  <Input
                    id="movie-title"
                    value={form.movieTitle}
                    maxLength={120}
                    onChange={(e) => setForm({ ...form, movieTitle: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movie-url">Movie URL (MP4 or HLS)</Label>
                  <Input
                    id="movie-url"
                    value={form.movieUrl}
                    onChange={(e) => setForm({ ...form, movieUrl: e.target.value })}
                    placeholder="https://…/film.m3u8 — you can also upload later"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                  <div>
                    <p className="text-sm font-medium">Private room</p>
                    <p className="text-xs text-muted-foreground">Only people with the code can join.</p>
                  </div>
                  <Switch
                    checked={form.isPrivate}
                    onCheckedChange={(v) => setForm({ ...form, isPrivate: v })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create room"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <form
          className="surface-panel mt-8 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            join.mutate(code);
          }}
        >
          <Label htmlFor="code" className="sm:w-40">
            Have an invite code?
          </Label>
          <Input
            id="code"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="sm:max-w-40 font-mono tracking-[0.3em] uppercase"
          />
          <Button type="submit" variant="secondary" disabled={join.isPending}>
            {join.isPending ? <Loader2 className="size-4 animate-spin" /> : "Join room"}
          </Button>
        </form>

        {invites.length > 0 && (
          <section className="mt-10">
            <h2 className="text-3xl">Invites from friends</h2>
            <ul className="mt-4 space-y-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="surface-panel flex flex-wrap items-center gap-3 rounded-xl p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xl">{invite.rooms?.name ?? "A watch room"}</p>
                    <p className="text-xs text-muted-foreground">
                      {invite.rooms?.movie_title || "No movie set yet"}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="sm"
                      disabled={respondInvite.isPending}
                      onClick={() =>
                        respondInvite.mutate({
                          id: invite.id,
                          status: "accepted",
                          code: invite.rooms?.code ?? null,
                        })
                      }
                    >
                      Join
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={respondInvite.isPending}
                      onClick={() =>
                        respondInvite.mutate({ id: invite.id, status: "declined", code: null })
                      }
                    >
                      Dismiss
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-3xl">Now screening</h2>

          {roomsQuery.isLoading ? (
            <div className="mt-6 flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : rooms.length === 0 ? (
            <p className="mt-6 text-muted-foreground">
              No rooms yet. Be the first to start a screening.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => navigate({ to: "/room/$code", params: { code: room.code } })}
                  className="surface-panel hover-lift rounded-xl p-5 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-2xl">{room.name}</h3>
                    <Badge variant={room.is_private ? "secondary" : "outline"}>
                      {room.is_private ? (
                        <Lock className="mr-1 size-3" />
                      ) : (
                        <Globe className="mr-1 size-3" />
                      )}
                      {room.is_private ? "Private" : "Public"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {room.description || room.movie_title || "No description"}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    <span className="font-mono tracking-widest">{room.code}</span>
                    {room.is_playing && <span className="text-accent">● playing</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
