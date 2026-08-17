import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Clapperboard, LogOut, ShieldAlert, User as UserIcon, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/hooks/use-session";
import { useProfile } from "@/lib/profile";
import { useNotifications } from "@/hooks/use-notifications";

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function AppHeader() {
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isStaff = profile?.role === "admin" || profile?.role === "moderator";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Clapperboard className="size-6 text-primary" />
          <span className="font-display text-2xl tracking-widest text-gradient">CINETOGETHER</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/rooms">Rooms</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/friends">Friends</Link>
              </Button>
              {isStaff && (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-amber-500">
                  <Link to="/moderation">
                    <ShieldAlert className="mr-1.5 size-4" /> Moderation
                  </Link>
                </Button>
              )}

              {/* Notification Bell Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="size-5" />
                    {unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center p-0 text-[10px]"
                      >
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => void markAllRead()}
                      >
                        Mark all as read
                      </button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto space-y-0.5 p-1">
                      {notifications.slice(0, 20).map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-2.5 rounded-md p-2 text-xs cursor-pointer transition-colors hover:bg-accent ${
                            !n.isRead ? "bg-primary/5" : ""
                          }`}
                          onClick={() => {
                            if (n.type === "friend_request" || n.type === "friend_request_accepted")
                              navigate({ to: "/friends" });
                            if (n.type === "room_invitation") navigate({ to: "/rooms" });
                          }}
                        >
                          {n.senderAvatar ? (
                            <Avatar className="size-7 shrink-0 border border-border">
                              <AvatarImage src={n.senderAvatar} alt="" />
                              <AvatarFallback className="text-[9px]">
                                {(n.senderName ?? "?").slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px]">
                              {n.type === "friend_request" ? "👤" : n.type === "room_invitation" ? "🎬" : "🔔"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-foreground leading-snug">{n.message}</div>
                            <div className="mt-0.5 text-muted-foreground">
                              {formatTimeAgo(n.createdAt)}
                            </div>
                          </div>
                          {!n.isRead && (
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">No notifications yet</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Profile User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full outline-hidden ring-ring focus-visible:ring-2">
                    <Avatar className="size-9 border border-border">
                      <AvatarImage src={profile?.avatar_url ?? undefined} alt="Your avatar" />
                      <AvatarFallback className="bg-secondary text-sm">
                        {(profile?.display_name ?? "C").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/rooms">Watch rooms</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/friends">
                      <Users className="mr-2 size-4" /> Friends
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <UserIcon className="mr-2 size-4" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem asChild>
                      <Link to="/moderation" className="text-amber-500">
                        <ShieldAlert className="mr-2 size-4" /> Moderation
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()}>
                    <LogOut className="mr-2 size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
