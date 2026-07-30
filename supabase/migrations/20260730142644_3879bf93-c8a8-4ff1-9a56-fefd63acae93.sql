
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_room_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_room_host(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_room_host(UUID, UUID) TO authenticated;
