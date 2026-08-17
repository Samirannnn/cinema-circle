-- ============================================================================
-- CINETOGETHER SCHEMA V3 MIGRATION SCRIPT
-- Adds: notifications table, auto-notification triggers
-- ============================================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,              -- 'friend_request' | 'friend_request_accepted' | 'room_invitation'
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reference_id UUID,              -- friendship ID or room_invite ID
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

-- RLS Policies
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. TRIGGER: Auto-create notification on new friend request
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sender_name TEXT;
BEGIN
  -- Only fire on new pending requests
  IF NEW.status = 'pending' THEN
    SELECT display_name INTO _sender_name FROM public.profiles WHERE id = NEW.requester_id;
    INSERT INTO public.notifications (user_id, type, sender_id, reference_id, message)
    VALUES (
      NEW.addressee_id,
      'friend_request',
      NEW.requester_id,
      NEW.id,
      COALESCE(_sender_name, 'Someone') || ' sent you a friend request'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_friend_request_created ON public.friendships;
CREATE TRIGGER on_friend_request_created
  AFTER INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();

-- 3. TRIGGER: Auto-create notification when friend request is accepted
CREATE OR REPLACE FUNCTION public.notify_friend_accepted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _accepter_name TEXT;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT display_name INTO _accepter_name FROM public.profiles WHERE id = NEW.addressee_id;
    INSERT INTO public.notifications (user_id, type, sender_id, reference_id, message)
    VALUES (
      NEW.requester_id,
      'friend_request_accepted',
      NEW.addressee_id,
      NEW.id,
      COALESCE(_accepter_name, 'Someone') || ' accepted your friend request'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_friend_request_accepted ON public.friendships;
CREATE TRIGGER on_friend_request_accepted
  AFTER UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_accepted();

-- 4. TRIGGER: Auto-create notification on room invitation
CREATE OR REPLACE FUNCTION public.notify_room_invitation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sender_name TEXT;
  _room_name TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT display_name INTO _sender_name FROM public.profiles WHERE id = NEW.inviter_id;
    SELECT name INTO _room_name FROM public.rooms WHERE id = NEW.room_id;
    INSERT INTO public.notifications (user_id, type, sender_id, reference_id, message)
    VALUES (
      NEW.invitee_id,
      'room_invitation',
      NEW.inviter_id,
      NEW.id,
      COALESCE(_sender_name, 'Someone') || ' invited you to room "' || COALESCE(_room_name, 'Watch Room') || '"'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_room_invitation_created ON public.room_invites;
CREATE TRIGGER on_room_invitation_created
  AFTER INSERT ON public.room_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_invitation();

-- 5. REALTIME REPLICATION
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
