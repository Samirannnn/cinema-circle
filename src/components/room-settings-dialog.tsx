import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock, Shield, UserMinus, UserCheck, Key, Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteRoom, type Room } from "@/lib/rooms";

type Props = {
  room: Room;
  isHost: boolean;
  memberIds: string[];
  nameFor: (id: string) => string;
  onRoomUpdated: (updated: Partial<Room>) => void;
};

export function RoomSettingsDialog({ room, isHost, memberIds, nameFor, onRoomUpdated }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(room.is_locked ?? false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!isHost) return null;

  async function toggleLock(checked: boolean) {
    setIsLocked(checked);
    const { error } = await supabase
      .from("rooms")
      .update({ is_locked: checked })
      .eq("id", room.id);

    if (error) {
      setIsLocked(!checked);
      return toast.error("Failed to update room lock state");
    }
    onRoomUpdated({ is_locked: checked });
    toast.success(checked ? "Room locked" : "Room unlocked");
  }

  async function updatePassword() {
    const { error } = await supabase
      .from("rooms")
      .update({ password_hash: password.trim() || null })
      .eq("id", room.id);

    if (error) return toast.error("Failed to set room password");
    onRoomUpdated({ password_hash: password.trim() || null });
    toast.success(password.trim() ? "Room password set" : "Room password removed");
    setPassword("");
  }

  async function kickUser(userId: string) {
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", room.id)
      .eq("user_id", userId);

    if (error) return toast.error("Couldn't kick participant");
    toast.success(`Kicked ${nameFor(userId)} from the room`);
  }

  async function transferHost(newHostId: string) {
    const { error } = await supabase
      .from("rooms")
      .update({ host_id: newHostId })
      .eq("id", room.id);

    if (error) return toast.error("Failed to transfer host role");
    onRoomUpdated({ host_id: newHostId });
    toast.success(`Host transferred to ${nameFor(newHostId)}`);
    setOpen(false);
  }

  async function handleDeleteRoom() {
    setDeleting(true);
    try {
      await deleteRoom(room.id, room.host_id);
      toast.success("Room permanently deleted");
      setOpen(false);
      navigate({ to: "/rooms", replace: true });
    } catch {
      toast.error("Failed to delete room");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 size-4" /> Room Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5 text-primary" /> Room & Security Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Lock Room Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Lock className="size-4" /> Lock Room
              </Label>
              <p className="text-xs text-muted-foreground">Prevent new members from joining</p>
            </div>
            <Switch checked={isLocked} onCheckedChange={(val) => void toggleLock(val)} />
          </div>

          {/* Password Protection */}
          <div className="space-y-2">
            <Label htmlFor="room-password" className="flex items-center gap-2">
              <Key className="size-4" /> Room Password
            </Label>
            <div className="flex gap-2">
              <Input
                id="room-password"
                type="password"
                placeholder="Optional password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button onClick={() => void updatePassword()} size="sm">
                Save
              </Button>
            </div>
          </div>

          {/* Participant Management */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Manage Participants</Label>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {memberIds
                .filter((id) => id !== room.host_id)
                .map((id) => (
                  <div key={id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                    <span>{nameFor(id)}</span>
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-primary"
                        onClick={() => void transferHost(id)}
                      >
                        <UserCheck className="mr-1 size-3.5" /> Make Host
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive"
                        onClick={() => void kickUser(id)}
                      >
                        <UserMinus className="mr-1 size-3.5" /> Kick
                      </Button>
                    </div>
                  </div>
                ))}
              {memberIds.length <= 1 && (
                <p className="text-center text-xs text-muted-foreground">No other participants in the room</p>
              )}
            </div>
          </div>

          {/* Delete Room Section */}
          <div className="border-t border-border/70 pt-4 space-y-2">
            <Label className="text-sm font-semibold text-destructive">Danger Zone</Label>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full" disabled={deleting}>
                  <Trash2 className="mr-2 size-4" /> Permanently Delete Room
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Permanently delete room <strong>"{room.name}"</strong> and all its chat messages & members?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleDeleteRoom()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Room
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
