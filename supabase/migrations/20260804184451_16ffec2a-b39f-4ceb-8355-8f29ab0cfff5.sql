CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT CASE WHEN _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room_id AND user_id = _user_id) END;
$function$;

CREATE OR REPLACE FUNCTION public.is_room_host(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT CASE WHEN _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.rooms WHERE id = _room_id AND host_id = _user_id) END;
$function$;

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT CASE WHEN auth.uid() NOT IN (_a, _b) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((requester_id = _a AND addressee_id = _b) OR (requester_id = _b AND addressee_id = _a))
    ) END;
$function$;