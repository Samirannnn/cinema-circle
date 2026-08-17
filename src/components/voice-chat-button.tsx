import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoiceChatButtonProps {
  roomId?: string;
  disabled?: boolean;
  className?: string;
}

export function VoiceChatButton({
  roomId: _roomId,
  disabled = true,
  className,
}: VoiceChatButtonProps) {
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
              aria-label="Voice Chat (Coming Soon)"
            >
              <Mic className="size-4 text-muted-foreground" />
              <span>Voice Chat</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                Coming Soon
              </Badge>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Coming Soon — Available in Phase 2</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
