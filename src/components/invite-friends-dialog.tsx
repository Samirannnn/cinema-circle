import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { inviteFriendToRoom, listFriendProfiles, listRoomInviteeIds } from "@/lib/friends";

/** Invite accepted friends straight into a room. */
export function InviteFriendsDialog({ roomId }: { roomId: string }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const friendsQuery = useQuery({
    queryKey: ["friend-profiles", user?.id],
    queryFn: () => listFriendProfiles(user!.id),
    enabled: Boolean(user?.id) && open,
  });

  const invitedQuery = useQuery({
    queryKey: ["room-invitees", roomId],
    queryFn: () => listRoomInviteeIds(roomId),
    enabled: open,
  });

  const invite = useMutation({
    mutationFn: (friendId: string) => inviteFriendToRoom(roomId, user!.id, friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room-invitees", roomId] });
      toast.success("Invite sent");
    },
    onError: () => toast.error("Couldn't send that invite"),
  });

  const friends = useMemo(() => {
    const all = friendsQuery.data ?? [];
    const clean = term.trim().toLowerCase();
    return clean ? all.filter((f) => f.display_name.toLowerCase().includes(clean)) : all;
  }, [friendsQuery.data, term]);

  const invited = new Set(invitedQuery.data ?? []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="mr-2 size-4" /> Invite friends
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite friends</DialogTitle>
          <DialogDescription>They'll see the invite on their rooms page.</DialogDescription>
        </DialogHeader>

        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Filter friends…" />

        {friendsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : friends.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No friends yet — add teammates from the Friends page first.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {friends.map((friend) => (
              <li
                key={friend.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 p-2"
              >
                <Avatar className="size-8">
                  <AvatarImage src={friend.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-secondary text-xs">
                    {friend.display_name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{friend.display_name}</span>
                <Button
                  size="sm"
                  variant={invited.has(friend.id) ? "secondary" : "default"}
                  className="ml-auto"
                  disabled={invite.isPending}
                  onClick={() => invite.mutate(friend.id)}
                >
                  {invited.has(friend.id) ? "Invite again" : "Invite"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
