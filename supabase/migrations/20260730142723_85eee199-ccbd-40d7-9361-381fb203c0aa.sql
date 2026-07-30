
CREATE POLICY "Signed-in can read avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Users manage own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Signed-in can read movies" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'movies');
CREATE POLICY "Users upload own movies" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'movies' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own movies" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'movies' AND (storage.foldername(name))[1] = auth.uid()::text);
