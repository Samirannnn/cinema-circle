-- ============================================================================
-- CINETOGETHER SCHEMA V2 MIGRATION SCRIPT
-- ============================================================================

-- 1. ADD ROLE TO PROFILES & ROOM SETTINGS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS co_host_ids UUID[] NOT NULL DEFAULT '{}';

-- 2. WATCH HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  movie_title TEXT NOT NULL,
  movie_url TEXT,
  poster_url TEXT,
  position_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, movie_title)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_history TO authenticated;
GRANT ALL ON public.watch_history TO service_role;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own watch history" ON public.watch_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own watch history" ON public.watch_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own watch history" ON public.watch_history
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own watch history" ON public.watch_history
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_watch_history_user ON public.watch_history (user_id, updated_at DESC);

-- 3. FAVORITES TABLE
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_title TEXT NOT NULL,
  movie_url TEXT,
  poster_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, movie_title)
);

GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own favorites" ON public.favorites
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users add favorites" ON public.favorites
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users remove favorites" ON public.favorites
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites (user_id);

-- 4. USER REPORTS & MODERATION TABLES
CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users submit reports" ON public.user_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Reporters or admins view reports" ON public.user_reports
  FOR SELECT TO authenticated USING (
    reporter_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );
CREATE POLICY "Admins update reports" ON public.user_reports
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- BLOCKED USERS
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own blocked users" ON public.blocked_users
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "Block user" ON public.blocked_users
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "Unblock user" ON public.blocked_users
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- ROOM BANS
CREATE TABLE IF NOT EXISTS public.room_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.room_bans TO authenticated;
GRANT ALL ON public.room_bans TO service_role;
ALTER TABLE public.room_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts/mods view room bans" ON public.room_bans
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() 
    OR public.is_room_host(room_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );
CREATE POLICY "Hosts/mods ban user from room" ON public.room_bans
  FOR INSERT TO authenticated WITH CHECK (
    public.is_room_host(room_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );
CREATE POLICY "Hosts/mods unban user from room" ON public.room_bans
  FOR DELETE TO authenticated USING (
    public.is_room_host(room_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- 5. REALTIME REPLICATION FOR NEW TABLES
ALTER TABLE public.watch_history REPLICA IDENTITY FULL;
ALTER TABLE public.favorites REPLICA IDENTITY FULL;
ALTER TABLE public.user_reports REPLICA IDENTITY FULL;
ALTER TABLE public.room_bans REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'watch_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_history;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'favorites') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.favorites;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_reports') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_reports;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'room_bans') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_bans;
  END IF;
END $$;
