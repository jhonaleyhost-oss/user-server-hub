
-- #1: Remove public access to completed reseller orders (contains PII)
DROP POLICY IF EXISTS "Anyone view completed orders" ON public.reseller_orders;

-- #3 & #4: Realtime channel authorization
-- Restrict realtime broadcasts so users only receive messages from topics they're authorized for.
-- Topic convention: support thread uses topic = 'support:<thread_user_id>'.
-- For other public tables (messages, activity_events, reseller_orders, etc.), authenticated users may subscribe.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Block private support topics unless user is the thread owner or admin
  CASE
    WHEN realtime.topic() LIKE 'support:%' THEN (
      public.is_admin(auth.uid())
      OR (substring(realtime.topic() from 9))::uuid = auth.uid()
    )
    ELSE true
  END
);

-- #7: Storage policies for tip-proofs (UPDATE/DELETE by owner or admin)
DROP POLICY IF EXISTS "Tip proofs owner update" ON storage.objects;
CREATE POLICY "Tip proofs owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tip-proofs' AND (owner = auth.uid() OR public.is_admin(auth.uid())))
WITH CHECK (bucket_id = 'tip-proofs' AND (owner = auth.uid() OR public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Tip proofs owner delete" ON storage.objects;
CREATE POLICY "Tip proofs owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tip-proofs' AND (owner = auth.uid() OR public.is_admin(auth.uid())));

-- Bonus: same for support-media (related warning, low risk)
DROP POLICY IF EXISTS "Support media owner update" ON storage.objects;
CREATE POLICY "Support media owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'support-media' AND (owner = auth.uid() OR public.is_admin(auth.uid())))
WITH CHECK (bucket_id = 'support-media' AND (owner = auth.uid() OR public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "Support media owner delete" ON storage.objects;
CREATE POLICY "Support media owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'support-media' AND (owner = auth.uid() OR public.is_admin(auth.uid())));
