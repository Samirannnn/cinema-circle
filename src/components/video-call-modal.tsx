import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MicOff, VideoOff, PhoneOff, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface VideoCallModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  friendId?: string;
  friendName?: string;
  friendAvatarUrl?: string;
}

export function VideoCallModal({
  open,
  onOpenChange,
  friendId: _friendId,
  friendName,
  friendAvatarUrl,
}: VideoCallModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg">
                {friendName ? `Call with ${friendName}` : "Video Call"}
              </DialogTitle>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                Coming Soon
              </Badge>
            </div>
          </div>
          <DialogDescription>
            1-on-1 direct video calling is launching in Phase 3.
          </DialogDescription>
        </DialogHeader>

        {/* Video Participant Stage Placeholder */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/70 bg-secondary/80 flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-3">
            <Avatar className="size-20 border-2 border-border shadow-md">
              <AvatarImage src={friendAvatarUrl} alt={friendName ?? "Friend"} />
              <AvatarFallback className="bg-muted text-xl font-semibold">
                {friendName ? (
                  friendName.slice(0, 1).toUpperCase()
                ) : (
                  <User className="size-8 text-muted-foreground" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-background border border-border">
              <VideoOff className="size-3 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground text-sm">
              {friendName ?? "Direct Video Call"}
            </p>
            <p className="text-xs text-muted-foreground">
              HD P2P video & screen sharing preview
            </p>
          </div>

          {/* Self View Mini-PIP Placeholder */}
          <div className="absolute bottom-3 right-3 flex h-16 w-24 items-center justify-center rounded-lg border border-border/80 bg-background/90 shadow-sm backdrop-blur">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <VideoOff className="size-3.5" />
              <span>You</span>
            </div>
          </div>
        </div>

        {/* Call Controls Toolbar Placeholder */}
        <TooltipProvider>
          <div className="flex items-center justify-center gap-3 pt-2">
            {/* Microphone Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled
                    className="size-10 rounded-full opacity-60 cursor-not-allowed"
                    aria-label="Microphone Toggle (Coming Soon)"
                  >
                    <MicOff className="size-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Microphone — Coming in Phase 3</p>
              </TooltipContent>
            </Tooltip>

            {/* Camera Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled
                    className="size-10 rounded-full opacity-60 cursor-not-allowed"
                    aria-label="Camera Toggle (Coming Soon)"
                  >
                    <VideoOff className="size-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Camera — Coming in Phase 3</p>
              </TooltipContent>
            </Tooltip>

            {/* End Call Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="destructive"
                    size="icon"
                    disabled
                    className="size-10 rounded-full opacity-60 cursor-not-allowed"
                    aria-label="End Call (Coming Soon)"
                  >
                    <PhoneOff className="size-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>End Call — Coming in Phase 3</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
