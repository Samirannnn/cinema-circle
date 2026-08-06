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
              <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
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
                    {unreadCount > 0 && <span className="text-xs text-muted-foreground">{unreadCount} new</span>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto space-y-1 p-1">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-md p-2 text-xs hover:bg-accent transition-colors"
                          onClick={() => {
                            if (n.type === "friend_request") navigate({ to: "/friends" });
                            if (n.type === "room_invite") navigate({ to: "/rooms" });
                          }}
                        >
                          <div className="font-semibold text-foreground">{n.title}</div>
                          <div className="text-muted-foreground">{n.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">No new notifications</div>
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
