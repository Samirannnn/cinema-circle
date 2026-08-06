import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/lib/profile";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/moderation")({
  head: () => ({
    meta: [
      { title: "Moderation Dashboard — CineTogether" },
      { name: "description", content: "Moderation dashboard for reports and room bans." },
    ],
  }),
  component: ModerationPage,
});

function ModerationPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isStaff = profile?.role === "admin" || profile?.role === "moderator";

  const { data: reports = [] } = useQuery({
    queryKey: ["user-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_reports")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isStaff,
  });

  async function resolveReport(reportId: string, status: "resolved" | "dismissed") {
    const { error } = await supabase
      .from("user_reports")
      .update({ status })
      .eq("id", reportId);

    if (error) return toast.error("Failed to update report status.");
    queryClient.invalidateQueries({ queryKey: ["user-reports"] });
    toast.success(`Report marked as ${status}.`);
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <ShieldAlert className="mx-auto size-12 text-destructive" />
          <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You must be an admin or moderator to view this page.
          </p>
          <Button onClick={() => navigate({ to: "/rooms" })} className="mt-6">
            Return to Rooms
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="size-7 text-amber-500" />
          <h1 className="text-3xl font-bold tracking-tight">Moderation Dashboard</h1>
          <Badge variant="outline" className="text-amber-500 border-amber-500/40">
            {profile.role.toUpperCase()}
          </Badge>
        </div>

        <div className="surface-panel overflow-hidden rounded-xl border border-border/60 p-6 space-y-4">
          <h2 className="text-xl font-semibold">User Reports ({reports.length})</h2>

          <div className="divide-y divide-border/60">
            {reports.map((report) => (
              <div key={report.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Report ID: {report.id.slice(0, 8)}</span>
                    <Badge variant={report.status === "pending" ? "destructive" : "secondary"}>
                      {report.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{report.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Reported User: {report.reported_user_id} • Reported by: {report.reporter_id}
                  </p>
                </div>

                {report.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button size="xs" variant="default" onClick={() => void resolveReport(report.id, "resolved")}>
                      <Check className="mr-1 size-3.5" /> Resolve
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => void resolveReport(report.id, "dismissed")}>
                      <Trash2 className="mr-1 size-3.5" /> Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {reports.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No reports submitted yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
