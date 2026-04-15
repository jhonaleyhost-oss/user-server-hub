-- Drop existing policy
DROP POLICY IF EXISTS "Users can delete their own panels" ON public.user_panels;

-- Recreate: only non-free users can delete their own panels
CREATE POLICY "Users can delete their own panels"
ON public.user_panels
FOR DELETE
USING (
  auth.uid() = user_id
  AND public.get_user_role(auth.uid()) != 'free'
);