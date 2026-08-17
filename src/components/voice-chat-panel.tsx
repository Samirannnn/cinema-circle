import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mic, MicOff, PhoneOff, Users, Volume2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface VoiceChatParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface VoiceChatPanelProps {
  roomId?: string;
  participants?: VoiceChatParticipant[];
  className?: string;
}

export function VoiceChatPanel({
  roomId: _roomId,
  participants = [],
  className,
}: VoiceChatPanelProps) {
  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex flex-col rounded-xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm",
          className,
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mic className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm leading-none">Voice Chat</h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  Coming Soon
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Phase 2 feature</p>
            </div>
          </div>
        </div>

        {/* Participant Audio List Placeholder */}
        <div className="my-4 flex-1 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              <span>Voice Participants</span>
            </span>
            <span className="text-[11px]">{participants.length} connected</span>
          </div>

          <div className="min-h-[120px] rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
            {participants.length > 0 ? (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage src={participant.avatarUrl} alt={participant.displayName} />
                        <AvatarFallback className="text-[10px]">
                          {participant.displayName.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground truncate max-w-[120px]">
                        {participant.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Volume2 className="size-3.5 opacity-50" />
                      <MicOff className="size-3.5 text-muted-foreground/60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[100px] flex-col items-center justify-center text-center">
                <Volume2 className="size-6 text-muted-foreground/40 mb-1" />
                <p className="text-xs text-muted-foreground font-medium">
                  Voice channels will be live in Phase 2
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  Spatial audio & low-latency voice chat
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Controls Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="w-full gap-1.5 opacity-60 cursor-not-allowed"
                >
                  <MicOff className="size-4" />
                  <span>Mute</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Coming Soon — Available in Phase 2</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex flex-1">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled
                  className="w-full gap-1.5 opacity-60 cursor-not-allowed"
                >
                  <PhoneOff className="size-4" />
                  <span>Leave</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Coming Soon — Available in Phase 2</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
