import { useEffect, useRef } from "react";
import { MicOff, VideoOff } from "lucide-react";
import type { RemotePeer } from "@/hooks/use-webrtc";

function Tile({
  stream,
  label,
  muted,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().length);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-border/70 bg-secondary">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={hasVideo ? "size-full object-cover" : "hidden"}
      />
      {!hasVideo && (
        <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
          <VideoOff className="size-5" />
          {!stream?.getAudioTracks().length && <MicOff className="size-4" />}
        </div>
      )}
      <span className="absolute bottom-1 left-2 rounded bg-background/70 px-1.5 py-0.5 text-[11px] font-medium backdrop-blur">
        {label}
      </span>
    </div>
  );
}

export function VideoGrid({
  localStream,
  peers,
  nameFor,
}: {
  localStream: MediaStream | null;
  peers: RemotePeer[];
  nameFor: (userId: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Tile stream={localStream} label="You" muted />
      {peers.map((peer) => (
        <Tile key={peer.userId} stream={peer.stream} label={nameFor(peer.userId)} />
      ))}
    </div>
  );
}
