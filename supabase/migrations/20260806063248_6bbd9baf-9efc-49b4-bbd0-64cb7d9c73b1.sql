CREATE POLICY "Inviter can resend invite"
ON public.room_invites
FOR UPDATE
TO authenticated
USING (inviter_id = auth.uid())
WITH CHECK (inviter_id = auth.uid() AND status = 'pending'::friendship_status);