import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clapperboard, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRoomInvite, respondToRoomInvite } from "@/lib/friends";
import { joinRoomByCode, type InvitePayload } from "@/lib/rooms";

/** Chat bubble for an invite link — the recipient can RSVP right here. */
export function InviteMessageCard({
  invite,
  senderName,
  roomId,
  currentUserId,
}: {
  invite: InvitePayload;
  senderName: string;
  roomId: string;
  currentUserId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isRecipient = Boolean(invite.inviteeId && invite.inviteeId === currentUserId);
  const inviteeId = invite.inviteeId;

  const rsvpQuery = useQuery({
    queryKey: ["room-invite", roomId, inviteeId],
    queryFn: () => getRoomInvite(roomId, inviteeId!),
    enabled: Boolean(inviteeId),
  });

  const status = rsvpQuery.data?.status ?? null;

  const respond = useMutation({
    mutationFn: async (next: "accepted" | "declined") => {
      const row = rsvpQuery.data;
      if (!row) throw new Error("Invite not found");
      await respondToRoomInvite(row.id, next);
      if (next === "accepted") await joinRoomByCode(invite.code);
      return next;
    },
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: ["room-invite", roomId, inviteeId] });
      queryClient.invalidateQueries({ queryKey: ["room-invites"] });
      if (next === "accepted") {
        toast.success("You're in — joining the room");
        void navigate({ to: "/room/$code", params: { code: invite.code } });
      } else {
        toast("Invite declined");
      }
    },
    onError: () => toast.error("Couldn't update your RSVP"),
  });

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-accent">
        <Clapperboard className="size-4" />
        {senderName} shared an invite
      </p>
      {invite.note && <p className="mt-1 text-sm text-muted-foreground">{invite.note}</p>}
      <p className="mt-2 font-mono text-xs tracking-widest text-muted-foreground">{invite.code}</p>

      {status && status !== "pending" && (
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {isRecipient ? "You" : (invite.inviteeName ?? "Invitee")}{" "}
          {status === "accepted" ? "accepted" : "declined"} this invite
        </p>
      )}
      {!isRecipient && inviteeId && status === "pending" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Waiting on {invite.inviteeName ?? "their"} RSVP…
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {isRecipient && status === "pending" ? (
          <>
            <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate("accepted")}>
              {respond.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={respond.isPending}
              onClick={() => respond.mutate("declined")}
            >
              <X className="mr-2 size-4" /> Decline
            </Button>
          </>
        ) : (
          <Button asChild size="sm">
            <Link to="/room/$code" params={{ code: invite.code }}>
              Join room
            </Link>
          </Button>
        )}
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
