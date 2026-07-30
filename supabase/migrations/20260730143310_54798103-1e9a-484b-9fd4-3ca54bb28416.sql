-- Allow joining a room (including private ones) by invite code.
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