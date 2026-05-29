-- Hapus semua feedback dari user Abu
DELETE FROM public.feedback WHERE user_id = 'acc1edd1-c4e4-4348-ab64-6b90937fb973';

-- Hanya 1 feedback per akun
ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_user_id_unique UNIQUE (user_id);