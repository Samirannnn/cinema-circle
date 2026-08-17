import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Send, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { inviteFriendToRoom, listUserActiveRooms } from "@/lib/friends";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendId: string;
  friendName: string;
};

/** Dialog to invite a friend to one of the user's active rooms (triggered from Friends page). */
export function InviteToRoomDialog({ open, onOpenChange, friendId, friendName }: Props) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const roomsQuery = useQuery({
    queryKey: ["user-active-rooms", user?.id],
    queryFn: () => listUserActiveRooms(user!.id),
    enabled: Boolean(user?.id) && open,
  });

  const invite = useMutation({
    mutationFn: async (roomId: string) => {
      await inviteFriendToRoom(roomId, user!.id, friendId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room-invitees"] });
      toast.success(`Invited ${friendName} to the room!`);
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to send invitation"),
  });

  const rooms = roomsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="size-5 text-primary" /> Invite {friendName} to a Room
          </DialogTitle>
          <DialogDescription>
            Select one of your active watch rooms to send an invitation.
          </DialogDescription>
        </DialogHeader>

        {roomsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              You don't have any active rooms. Create a room first, then invite friends.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate({ to: "/rooms" });
              }}
            >
              Go to Rooms
            </Button>
          </div>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {rooms.map((room) => (
              <li
                key={room.id}
                className={`flex items-center justify-between rounded-lg border p-3 text-sm cursor-pointer transition-colors ${
                  selectedRoomId === room.id
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:bg-accent/50"
                }`}
                onClick={() => setSelectedRoomId(room.id)}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{room.name}</div>
                  {room.movie_title && (
                    <div className="truncate text-xs text-muted-foreground">
                      🎬 {room.movie_title}
                    </div>
                  )}
                </div>
                <code className="ml-2 shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs">
                  {room.code}
                </code>
              </li>
            ))}
          </ul>
        )}

        {rooms.length > 0 && (
          <Button
            className="w-full"
            disabled={!selectedRoomId || invite.isPending}
            onClick={() => selectedRoomId && invite.mutate(selectedRoomId)}
          >
            {invite.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            Send Invitation
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
