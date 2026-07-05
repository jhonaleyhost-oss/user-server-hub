ALTER TABLE public.reseller_orders DROP CONSTRAINT IF EXISTS reseller_orders_plan_check;

ALTER TABLE public.reseller_orders
  ADD CONSTRAINT reseller_orders_plan_check
  CHECK (plan = ANY (ARRAY[
    '1bln'::text,
    '2bln'::text,
    'perm'::text,
    'adp'::text,
    'adp_1bln'::text,
    'adp_2bln'::text,
    'adp_perm'::text
  ]));