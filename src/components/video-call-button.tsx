import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VideoCallButtonProps {
  friendId?: string;
  friendName?: string;
  disabled?: boolean;
  className?: string;
}

export function VideoCallButton({
  friendId: _friendId,
  friendName,
  disabled = true,
  className,
}: VideoCallButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              className={cn("gap-2 opacity-60 cursor-not-allowed", className)}
              aria-label={`Video Call ${friendName ? `with ${friendName}` : ""} (Coming Soon)`}
            >
              <Video className="size-4 text-muted-foreground" />
              <span>Video Call</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                Coming Soon
              </Badge>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Coming Soon — Available in Phase 3</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
