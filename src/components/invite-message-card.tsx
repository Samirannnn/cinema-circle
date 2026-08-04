import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvitePayload } from "@/lib/rooms";

/** Chat bubble for an invite link — one tap to join, one to copy. */
export function InviteMessageCard({
  invite,
  senderName,
}: {
  invite: InvitePayload;
  senderName: string;
}) {
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-accent">
        <Clapperboard className="size-4" />
        {senderName} shared an invite
      </p>
      {invite.note && <p className="mt-1 text-sm text-muted-foreground">{invite.note}</p>}
      <p className="mt-2 font-mono text-xs tracking-widest text-muted-foreground">{invite.code}</p>
      <div className="mt-3 flex gap-2">
        <Button asChild size="sm">
          <Link to="/room/$code" params={{ code: invite.code }}>
            Join room
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(invite.url);
            toast.success("Invite link copied");
          }}
        >
          <Copy className="mr-2 size-4" /> Copy link
        </Button>
      </div>
    </div>
  );
}
