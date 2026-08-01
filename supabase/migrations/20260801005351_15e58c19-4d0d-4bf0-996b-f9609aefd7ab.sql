CREATE TABLE IF NOT EXISTS public.austin_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE,
  transaction_id text NOT NULL,
  base_amount integer NOT NULL,
  final_amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  qr_string text,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.austin_payments TO service_role;
ALTER TABLE public.austin_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS austin_payments_txn_idx ON public.austin_payments (transaction_id);