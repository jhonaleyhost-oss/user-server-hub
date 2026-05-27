ALTER PUBLICATION supabase_realtime ADD TABLE public.user_panels;
ALTER TABLE public.user_panels REPLICA IDENTITY FULL;