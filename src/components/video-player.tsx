import { useEffect, useRef, useState } from "react";
import Hls, { Level } from "hls.js";
import {
  AlertCircle,
  Check,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isValidStreamUrl } from "@/lib/sanitizer";

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

export function VideoPlayer({
  src,
  isHost,
  isPlaying,
  positionSeconds,
  lastSyncAt,
  onHostChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // HLS Quality levels state
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = Auto

  // Load stream & wire HLS
  const loadStream = () => {
    const video = videoRef.current;
    if (!video || !src) return;
    setReady(false);
    setBuffering(true);
    setStreamError(null);

    if (src.startsWith("http") && !isValidStreamUrl(src)) {
      setStreamError("Invalid stream URL provided.");
      setBuffering(false);
      return;
    }

    const isHls = /\.m3u8($|\?)/i.test(src);

    if (isHls && Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setLevels(data.levels);
        setBuffering(false);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("HLS network error, attempting recovery...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("HLS media error, recovering...");
              hls.recoverMediaError();
              break;
            default:
              setStreamError("Failed to load stream. Please check video URL.");
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    video.src = src;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  };

  useEffect(() => {
    const cleanup = loadStream();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [src]);

  // Sync with host authoritative state
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

  function selectQualityLevel(index: number) {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = index;
    setCurrentLevel(index);
  }

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
          <>
            <video
              ref={videoRef}
              className="size-full"
              playsInline
              muted={muted}
              onWaiting={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration);
                setReady(true);
                setBuffering(false);
              }}
              onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
              onError={() => {
                setStreamError("Failed to play video. Check URL accessibility or format.");
                setBuffering(false);
              }}
            />

            {/* Buffering overlay */}
            {buffering && !streamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            )}

            {/* Stream Error overlay */}
            {streamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center text-destructive">
                <AlertCircle className="mb-2 size-8" />
                <p className="text-sm font-medium">{streamError}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => loadStream()}>
                  <RefreshCw className="mr-2 size-3.5" /> Retry Stream
                </Button>
              </div>
            )}
          </>
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
        <div className="flex items-center gap-2 flex-wrap">
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
            {/* HLS Quality Selector Dropdown */}
            {levels.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs">
                    <Settings className="size-3.5" />
                    <span>{currentLevel === -1 ? "Auto" : `${levels[currentLevel]?.height}p`}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem onClick={() => selectQualityLevel(-1)} className="justify-between text-xs">
                    <span>Auto</span>
                    {currentLevel === -1 && <Check className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                  {levels.map((lvl, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={() => selectQualityLevel(index)}
                      className="justify-between text-xs"
                    >
                      <span>{lvl.height}p</span>
                      {currentLevel === index && <Check className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button size="icon" variant="ghost" onClick={() => setMuted((m) => !m)}>
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <Slider
              className="w-20 sm:w-24"
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
