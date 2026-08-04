-- 1. Revoke direct execution of trigger-only SECURITY DEFINER / helper functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 2. Avatars: owner-scoped reads only
DROP POLICY IF EXISTS "Signed-in can read avatars" ON storage.objects;
CREATE POLICY "Users read own avatar"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Movies: uploader or room member/host only
DROP POLICY IF EXISTS "Signed-in can read movies" ON storage.objects;
CREATE POLICY "Room members read movies"
ON storage.objects FOR SELECT TO authenticated
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