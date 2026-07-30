import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader2, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

type Props = {
  src: string | null;
  isHost: boolean;
  isPlaying: boolean;
  positionSeconds: number;
  lastSyncAt: string;
  onHostChange: (state: { isPlaying: boolean; positionSeconds: number }) => void;
};

/**
 * Synced player. Everyone follows the room's authoritative playback state;
 * only the host can change it. Guests drift-correct whenever they fall more
 * than a second behind the projected room position.
 */
export function VideoPlayer({
  src,
  isHost,
  isPlaying,
  positionSeconds,
  lastSyncAt,
  onHostChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Source wiring (HLS or progressive)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setReady(false);

    const isHls = /\.m3u8($|\?)/i.test(src);
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    video.src = src;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  // Follow the room's authoritative state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    const elapsed = isPlaying ? (Date.now() - new Date(lastSyncAt).getTime()) / 1000 : 0;
    const target = positionSeconds + Math.max(0, elapsed);

    if (Math.abs(video.currentTime - target) > 1.2) {
      video.currentTime = target;
    }
    if (isPlaying && video.paused) void video.play().catch(() => undefined);
    if (!isPlaying && !video.paused) video.pause();
  }, [isPlaying, positionSeconds, lastSyncAt, ready]);

  function hostSeek(next: number) {
    if (!isHost) return;
    const video = videoRef.current;
    if (video) video.currentTime = next;
    onHostChange({ isPlaying, positionSeconds: next });
  }

  function togglePlay() {
    if (!isHost) return;
    onHostChange({
      isPlaying: !isPlaying,
      positionSeconds: videoRef.current?.currentTime ?? positionSeconds,
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-black">
      <div className="relative aspect-video">
        {src ? (
          <video
            ref={videoRef}
            className="size-full"
            playsInline
            muted={muted}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              setReady(true);
            }}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <p className="text-sm">No movie loaded yet — the host can add one.</p>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-border/70 bg-card px-4 py-3">
        <Slider
          value={[current]}
          max={duration || 100}
          step={1}
          disabled={!isHost || !src}
          onValueChange={([v]) => setCurrent(v)}
          onValueCommit={([v]) => hostSeek(v)}
        />
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" disabled={!isHost || !src} onClick={togglePlay}>
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={!isHost || !src}
            onClick={() => hostSeek(Math.max(0, current - 10))}
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={!isHost || !src}
            onClick={() => hostSeek(current + 10)}
          >
            <RotateCw className="size-4" />
          </Button>

          <span className="ml-1 text-xs tabular-nums text-muted-foreground">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setMuted((m) => !m)}>
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <Slider
              className="w-24"
              value={[muted ? 0 : volume]}
              max={1}
              step={0.05}
              onValueChange={([v]) => {
                setVolume(v);
                setMuted(v === 0);
                if (videoRef.current) videoRef.current.volume = v;
              }}
            />
          </div>
        </div>
        {!isHost && (
          <p className="text-xs text-muted-foreground">
            Playback is controlled by the host — you'll stay in sync automatically.
          </p>
        )}
      </div>
    </div>
  );
}
