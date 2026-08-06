import { useState } from "react";
import { toast } from "sonner";
import { Flag, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  reportedUserId: string;
  reportedUserName: string;
  roomId?: string;
  currentUserId?: string;
};

export function ReportUserDialog({ reportedUserId, reportedUserName, roomId, currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!currentUserId || currentUserId === reportedUserId) return null;

  async function handleReport() {
    if (!reason.trim()) return toast.error("Please provide a reason for the report.");
    setSubmitting(true);

    const { error } = await supabase.from("user_reports").insert({
      reporter_id: currentUserId,
      reported_user_id: reportedUserId,
      room_id: roomId || null,
      reason: reason.trim(),
    });

    setSubmitting(false);

    if (error) return toast.error("Failed to submit report.");
    toast.success(`Report submitted for ${reportedUserName}. Moderators will review.`);
    setReason("");
    setOpen(false);
  }

  async function handleBlock() {
    const { error } = await supabase.from("blocked_users").insert({
      blocker_id: currentUserId,
      blocked_id: reportedUserId,
    });

    if (error) return toast.error("Failed to block user or user already blocked.");
    toast.success(`Blocked ${reportedUserName}.`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive">
          <Flag className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Report or Block User</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason for reporting {reportedUserName}</Label>
            <Textarea
              id="report-reason"
              placeholder="Spam, harassment, inappropriate content..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void handleReport()} disabled={submitting} size="sm" className="flex-1">
              Submit Report
            </Button>
            <Button onClick={() => void handleBlock()} variant="outline" size="sm" className="text-destructive">
              <ShieldOff className="mr-1.5 size-3.5" /> Block
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
