-- ============================================================================
-- COMPLETE DATABASE SCHEMA MIGRATION SCRIPT FOR SUPABASE PROJECT: bsnnluusxvbpjfqvmvtf
-- ============================================================================

-- 1. ENUMS
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'declined');

-- 2. HELPER FUNCTIONS & TRIGGERS FOR TIMESTAMPS & USER PROFILES
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Cinephile'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Trigger to automatically create profile on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. TABLES
-- PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Cinephile',
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROOMS TABLE
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_title TEXT,
  movie_url TEXT,
  poster_url TEXT,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  position_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  playback_rate DOUBLE PRECISION NOT NULL DEFAULT 1,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROOM MEMBERS TABLE
CREATE TABLE public.room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hand_raised BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_members TO authenticated;
GRANT ALL ON public.room_members TO service_role;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_members_room ON public.room_members(room_id);

-- MESSAGES TABLE
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_messages_room ON public.messages(room_id, created_at);

-- FRIENDSHIPS TABLE
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friendships_distinct CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER friendships_set_updated_at BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX friendships_requester_idx ON public.friendships (requester_id);
CREATE INDEX friendships_addressee_idx ON public.friendships (addressee_id);

-- ROOM INVITES TABLE
CREATE TABLE public.room_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT room_invites_distinct CHECK (inviter_id <> invitee_id),
  CONSTRAINT room_invites_unique UNIQUE (room_id, invitee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_invites TO authenticated;
GRANT ALL ON public.room_invites TO service_role;
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER room_invites_set_updated_at BEFORE UPDATE ON public.room_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX room_invites_invitee_idx ON public.room_invites (invitee_id);

-- 4. SECURITY DEFINER HELPER FUNCTIONS FOR RLS
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id) END;
$$;
REVOKE ALL ON FUNCTION public.is_room_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_room_host(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.rooms WHERE id = _room_id AND host_id = _user_id) END;
$$;
REVOKE ALL ON FUNCTION public.is_room_host(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_host(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN auth.uid() NOT IN (_a, _b) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a))
    ) END;
$$;
REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.join_room_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room_id UUID;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _room_id
  FROM public.rooms
  WHERE code = upper(trim(_code)) AND is_active;

  IF _room_id IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  INSERT INTO public.room_members (room_id, user_id)
  VALUES (_room_id, _uid)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN _room_id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_room_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_room_by_code(TEXT) TO authenticated;

-- 5. RLS POLICIES
-- PROFILES POLICIES
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ROOMS POLICIES
CREATE POLICY "View public rooms or own rooms" ON public.rooms FOR SELECT TO authenticated
  USING (NOT is_private OR host_id = auth.uid() OR public.is_room_member(id, auth.uid()));
CREATE POLICY "Users create own rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "Host updates room" ON public.rooms FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "Host deletes room" ON public.rooms FOR DELETE TO authenticated USING (host_id = auth.uid());

-- ROOM MEMBERS POLICIES
CREATE POLICY "View members of accessible rooms" ON public.room_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_room_member(room_id, auth.uid()) OR public.is_room_host(room_id, auth.uid()));
CREATE POLICY "Users join rooms" ON public.room_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own membership" ON public.room_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave or host removes" ON public.room_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_host(room_id, auth.uid()));

-- MESSAGES POLICIES
CREATE POLICY "Members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()) OR public.is_room_host(room_id, auth.uid()));
CREATE POLICY "Members post messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_room_member(room_id, auth.uid()) OR public.is_room_host(room_id, auth.uid())));
CREATE POLICY "Delete own or host deletes" ON public.messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_host(room_id, auth.uid()));

-- FRIENDSHIPS POLICIES
CREATE POLICY "View own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "Send friend requests" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');
CREATE POLICY "Addressee responds" ON public.friendships FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid()) WITH CHECK (addressee_id = auth.uid());
CREATE POLICY "Either side removes" ON public.friendships FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- ROOM INVITES POLICIES
CREATE POLICY "View own invites" ON public.room_invites FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());
CREATE POLICY "Members invite friends" ON public.room_invites FOR INSERT TO authenticated
  WITH CHECK (
    inviter_id = auth.uid()
    AND status = 'pending'
    AND (public.is_room_member(room_id, auth.uid()) OR public.is_room_host(room_id, auth.uid()))
    AND public.are_friends(auth.uid(), invitee_id)
  );
CREATE POLICY "Invitee responds" ON public.room_invites FOR UPDATE TO authenticated
  USING (invitee_id = auth.uid()) WITH CHECK (invitee_id = auth.uid());
CREATE POLICY "Inviter can resend invite" ON public.room_invites FOR UPDATE TO authenticated
  USING (inviter_id = auth.uid()) WITH CHECK (inviter_id = auth.uid() AND status = 'pending'::friendship_status);
CREATE POLICY "Either side deletes invite" ON public.room_invites FOR DELETE TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- 6. STORAGE BUCKETS & STORAGE RLS POLICIES
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('movies', 'movies', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own avatar" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users manage own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Room members read movies" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'movies'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.rooms r
        WHERE r.movie_url = 'storage:' || storage.objects.name
          AND (r.host_id = auth.uid() OR public.is_room_member(r.id, auth.uid()))
      )
    )
  );
CREATE POLICY "Users upload own movies" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'movies' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own movies" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'movies' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 7. REALTIME REPLICATION & PUBLICATION SETUP
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_members REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.room_invites REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rooms') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'room_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'friendships') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'room_invites') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invites;
  END IF;
END $$;
