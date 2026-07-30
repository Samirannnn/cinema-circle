
-- PROFILES
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
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ROOMS
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

-- helper functions (security definer, avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_room_host(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id = _room_id AND host_id = _user_id);
$$;

-- ROOM POLICIES
CREATE POLICY "View public rooms or own rooms" ON public.rooms FOR SELECT TO authenticated
  USING (NOT is_private OR host_id = auth.uid() OR public.is_room_member(id, auth.uid()));
CREATE POLICY "Users create own rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "Host updates room" ON public.rooms FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "Host deletes room" ON public.rooms FOR DELETE TO authenticated USING (host_id = auth.uid());

-- MEMBER POLICIES
CREATE POLICY "View members of accessible rooms" ON public.room_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_room_member(room_id, auth.uid()) OR public.is_room_host(room_id, auth.uid()));
CREATE POLICY "Users join rooms" ON public.room_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own membership" ON public.room_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave or host removes" ON public.room_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_host(room_id, auth.uid()));

-- MESSAGE POLICIES
CREATE POLICY "Members read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()) OR public.is_room_host(room_id, auth.uid()));
CREATE POLICY "Members post messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_room_member(room_id, auth.uid()) OR public.is_room_host(room_id, auth.uid())));
CREATE POLICY "Delete own or host deletes" ON public.messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_host(room_id, auth.uid()));

CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_messages_room ON public.messages(room_id, created_at);
CREATE INDEX idx_members_room ON public.room_members(room_id);

ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_members REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
