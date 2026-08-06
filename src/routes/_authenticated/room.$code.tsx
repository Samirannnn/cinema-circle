import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Hand,
  Link2 as LinkIcon,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Send,
  Upload,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppHeader } from "@/components/app-header";
import { VideoPlayer } from "@/components/video-player";
import { VideoGrid } from "@/components/video-grid";
import { InviteFriendsDialog } from "@/components/invite-friends-dialog";
import { InviteMessageCard } from "@/components/invite-message-card";
import { RoomSettingsDialog } from "@/components/room-settings-dialog";
import { ReportUserDialog } from "@/components/report-dialog";
import { ErrorBoundary } from "@/components/error-boundary";

import { useSession } from "@/hooks/use-session";
import { useWebRTC } from "@/hooks/use-webrtc";
import { useWatchHistoryTracker } from "@/hooks/use-watch-history";
import { sanitizeText, isValidStreamUrl } from "@/lib/sanitizer";
import { isRateLimited } from "@/lib/rate-limiter";
import {
  fetchProfilesByIds,
  fetchRoomByCode,
  joinRoomByCode,
  parseInviteBody,
  postInviteMessage,
  resolveMovieUrl,
  type Message,
  type Room,
} from "@/lib/rooms";

export const Route = createFileRoute("/_authenticated/room/$code")({
  head: () => ({
    meta: [
      { title: "Watch room — CineTogether" },
      { name: "description", content: "A synchronized watch room with live video, voice and chat." },
      { property: "og:title", content: "Watch room — CineTogether" },
      { property: "og:description", content: "A synchronized watch room with live video, voice and chat." },
    ],
  }),
  component: RoomPageWrapper,
});

function RoomPageWrapper() {
  return (
    <ErrorBoundary fallbackMessage="An error occurred in this watch room.">
      <RoomPage />
    </ErrorBoundary>
  );
}

function RoomPage() {
  const { code } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [handRaised, setHandRaised] = useState(false);
  const [movieUrlInput, setMovieUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isHost = Boolean(user && room && room.host_id === user.id);
  const rtc = useWebRTC(room?.id, user?.id);

  // Auto-track Watch History position
  useWatchHistoryTracker({
    roomId: room?.id,
    movieTitle: room?.movie_title || room?.name,
    movieUrl: room?.movie_url,
    posterUrl: room?.poster_url,
    positionSeconds: room?.position_seconds ?? 0,
    durationSeconds: 0,
    isPlaying: room?.is_playing ?? false,
  });

  // Join the room & load its state
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        await joinRoomByCode(code);
        const found = await fetchRoomByCode(code);
        if (cancelled) return;
        if (!found) {
          toast.error("That room doesn't exist");
          navigate({ to: "/rooms", replace: true });
          return;
        }
        setRoom(found);
        setMovieUrlInput(found.movie_url?.startsWith("storage:") ? "" : (found.movie_url ?? ""));
      } catch {
        if (!cancelled) {
          toast.error("Couldn't join that room");
          navigate({ to: "/rooms", replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  const roomId = room?.id;

  // Initial chat + members
  useEffect(() => {
    if (!roomId) return;
    void supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => setMessages(data ?? []));

    void supabase
      .from("room_members")
      .select("user_id, hand_raised")
      .eq("room_id", roomId)
      .then(({ data }) => setMemberIds((data ?? []).map((m) => m.user_id)));
  }, [roomId]);

  // Realtime playback, chat, members
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as Room),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => {
          toast.error("This watch room was deleted by the host");
          navigate({ to: "/rooms", replace: true });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        async () => {
          const { data } = await supabase
            .from("room_members")
            .select("user_id")
            .eq("room_id", roomId);
          setMemberIds((data ?? []).map((m) => m.user_id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const participantIds = useMemo(
    () => Array.from(new Set([...memberIds, ...messages.map((m) => m.user_id)])),
    [memberIds, messages],
  );

  const profilesQuery = useQuery({
    queryKey: ["profiles", participantIds],
    queryFn: () => fetchProfilesByIds(participantIds),
    enabled: participantIds.length > 0,
  });

  const nameFor = useCallback(
    (id: string) =>
      profilesQuery.data?.find((p) => p.id === id)?.display_name ?? "Guest",
    [profilesQuery.data],
  );

  const movieQuery = useQuery({
    queryKey: ["movie-url", room?.movie_url],
    queryFn: () => resolveMovieUrl(room?.movie_url ?? null),
    enabled: Boolean(room?.movie_url),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (isRateLimited(`msg:${user?.id}`, 5, 5000)) {
      return toast.error("Slow down! Too many messages sent.");
    }
    const clean = sanitizeText(draft.trim().slice(0, 1000));
    if (!clean || !room || !user) return;
    setDraft("");
    const { error } = await supabase
      .from("messages")
      .insert({ room_id: room.id, user_id: user.id, body: clean });
    if (error) toast.error("Message failed to send");
  }

  async function shareInviteLink() {
    if (!room || !user) return;
    const note = draft.trim().slice(0, 200);
    setDraft("");
    try {
      await postInviteMessage({ roomId: room.id, userId: user.id, code: room.code, note: note || undefined });
    } catch {
      toast.error("Couldn't share the invite link");
    }
  }

  async function pushPlayback(next: { isPlaying: boolean; positionSeconds: number }) {
    if (!room || !isHost) return;
    setRoom({ ...room, is_playing: next.isPlaying, position_seconds: next.positionSeconds });
    const { error } = await supabase
      .from("rooms")
      .update({
        is_playing: next.isPlaying,
        position_seconds: next.positionSeconds,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", room.id);
    if (error) toast.error("Couldn't sync playback");
  }

  async function toggleHand() {
    if (!room || !user) return;
    const next = !handRaised;
    setHandRaised(next);
    await supabase
      .from("room_members")
      .update({ hand_raised: next })
      .eq("room_id", room.id)
      .eq("user_id", user.id);
  }

  async function saveMovieUrl() {
    if (!room || !isHost) return;
    const url = movieUrlInput.trim();
    if (url && !isValidStreamUrl(url)) return toast.error("Enter a valid http(s) stream URL");
    const { error } = await supabase
      .from("rooms")
      .update({ movie_url: url || null, position_seconds: 0, is_playing: false, last_sync_at: new Date().toISOString() })
      .eq("id", room.id);
    if (error) return toast.error("Couldn't update the movie");
    queryClient.invalidateQueries({ queryKey: ["movie-url"] });
    toast.success("Movie updated for everyone");
  }

  async function uploadMovie(file: File) {
    if (!room || !user || !isHost) return;
    // Hardening: check file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      return toast.error("File size exceeds maximum limit of 500MB");
    }
    if (!file.type.startsWith("video/")) {
      return toast.error("Please upload a valid video file format");
    }

    setUploading(true);
    const path = `${user.id}/${room.id}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("movies").upload(path, file, { upsert: false });
    if (error) {
      setUploading(false);
      return toast.error("Upload failed");
    }
    await supabase
      .from("rooms")
      .update({
        movie_url: `storage:${path}`,
        movie_title: room.movie_title ?? file.name,
        position_seconds: 0,
        is_playing: false,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", room.id);
    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ["movie-url"] });
    toast.success("Movie uploaded");
  }

  if (loading || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  // Common Chat Component
  const ChatView = (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
        <div className="space-y-3 pb-4">
          {messages.map((message) => {
            const invite = message.kind === "invite" ? parseInviteBody(message.body) : null;
            if (invite) {
              return (
                <InviteMessageCard
                  key={message.id}
                  invite={invite}
                  senderName={nameFor(message.user_id)}
                  roomId={room.id}
                  currentUserId={user?.id}
                />
              );
            }
            return (
              <div key={message.id} className="text-sm flex items-center justify-between group">
                <div>
                  <span className="font-semibold text-accent">{nameFor(message.user_id)}</span>{" "}
                  <span className="text-muted-foreground">{message.body}</span>
                </div>
                <ReportUserDialog
                  reportedUserId={message.user_id}
                  reportedUserName={nameFor(message.user_id)}
                  roomId={room.id}
                  currentUserId={user?.id}
                />
              </div>
            );
          })}
          {messages.length === 0 && (
            <p className="pt-6 text-center text-sm text-muted-foreground">
              Say something to start the conversation.
            </p>
          )}
        </div>
      </div>
      <form onSubmit={sendMessage} className="flex gap-2 border-t border-border/70 p-3">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Share invite link in chat"
          onClick={() => void shareInviteLink()}
        >
          <LinkIcon className="size-4" />
        </Button>
        <Input
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the room"
        />
        <Button type="submit" size="icon" aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/rooms">
              <ArrowLeft className="mr-1 size-4" /> Rooms
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{room.name}</h1>
          {isHost && <Badge>Host</Badge>}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <InviteFriendsDialog roomId={room.id} roomCode={room.code} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(`${window.location.origin}/room/${room.code}`);
                toast.success("Invite link copied");
              }}
            >
              <Copy className="mr-2 size-4" />
              <span className="font-mono tracking-widest">{room.code}</span>
            </Button>

            <RoomSettingsDialog
              room={room}
              isHost={isHost}
              memberIds={memberIds}
              nameFor={nameFor}
              onRoomUpdated={(partial) => setRoom({ ...room, ...partial })}
            />

            {/* Mobile Chat Drawer Button */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <MessageSquare className="mr-1.5 size-4" /> Chat
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                  <SheetHeader className="p-4 border-b">
                    <SheetTitle>Room Chat</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-hidden">{ChatView}</div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <VideoPlayer
              src={movieQuery.data ?? null}
              isHost={isHost}
              isPlaying={room.is_playing}
              positionSeconds={room.position_seconds}
              lastSyncAt={room.last_sync_at}
              onHostChange={(next) => void pushPlayback(next)}
            />

            <div className="flex flex-wrap gap-2">
              <Button variant={rtc.cameraOn ? "default" : "secondary"} onClick={() => void rtc.toggleCamera()}>
                {rtc.cameraOn ? <VideoIcon className="mr-2 size-4" /> : <VideoOff className="mr-2 size-4" />}
                Camera
              </Button>
              <Button variant={rtc.micOn ? "default" : "secondary"} onClick={() => void rtc.toggleMic()}>
                {rtc.micOn ? <Mic className="mr-2 size-4" /> : <MicOff className="mr-2 size-4" />}
                Mic
              </Button>
              <Button variant={rtc.sharingScreen ? "default" : "secondary"} onClick={() => void rtc.toggleScreenShare()}>
                <MonitorUp className="mr-2 size-4" /> Share screen
              </Button>
              <Button variant={handRaised ? "default" : "secondary"} onClick={() => void toggleHand()}>
                <Hand className="mr-2 size-4" /> {handRaised ? "Lower hand" : "Raise hand"}
              </Button>
            </div>
            {rtc.mediaError && <p className="text-sm text-destructive">{rtc.mediaError}</p>}

            {isHost && (
              <div className="surface-panel space-y-3 rounded-xl p-4">
                <h2 className="text-2xl font-bold">Host controls</h2>
                <div className="space-y-2">
                  <Label htmlFor="movie-src">Movie URL (MP4 or HLS)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="movie-src"
                      value={movieUrlInput}
                      onChange={(e) => setMovieUrlInput(e.target.value)}
                      placeholder="https://…/film.m3u8"
                    />
                    <Button onClick={() => void saveMovieUrl()}>Set</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movie-file">Or upload a file (Max 500MB)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="movie-file"
                      type="file"
                      accept="video/*"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadMovie(file);
                      }}
                    />
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="hidden lg:flex surface-panel h-[70vh] flex-col rounded-xl">
            <Tabs defaultValue="chat" className="flex h-full flex-col">
              <TabsList className="m-3 grid grid-cols-2">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="people">People ({memberIds.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
                {ChatView}
              </TabsContent>

              <TabsContent value="people" className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
                <VideoGrid localStream={rtc.localStream} peers={rtc.peers} nameFor={nameFor} />
                <ul className="mt-4 space-y-2 text-sm max-h-48 overflow-y-auto">
                  {memberIds.map((id) => (
                    <li key={id} className="flex items-center justify-between">
                      <span>{nameFor(id)}</span>
                      {id === room.host_id && <Badge variant="secondary">Host</Badge>}
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      </main>
    </div>
  );
}
