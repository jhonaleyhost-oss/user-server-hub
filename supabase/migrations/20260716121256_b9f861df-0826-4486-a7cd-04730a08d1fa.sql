
ALTER TABLE public.role_warranty_claims
  ADD COLUMN IF NOT EXISTS invoice_image_paths text[] NOT NULL DEFAULT '{}';

-- Backfill: existing single path becomes first item
UPDATE public.role_warranty_claims
SET invoice_image_paths = ARRAY[COALESCE(invoice_storage_path, invoice_image_url)]
WHERE (invoice_image_paths IS NULL OR array_length(invoice_image_paths, 1) IS NULL)
  AND (invoice_storage_path IS NOT NULL OR invoice_image_url IS NOT NULL);

-- Limit max 10 images per claim
ALTER TABLE public.role_warranty_claims
  DROP CONSTRAINT IF EXISTS warranty_images_max;
ALTER TABLE public.role_warranty_claims
  ADD CONSTRAINT warranty_images_max
  CHECK (array_length(invoice_image_paths, 1) IS NULL OR array_length(invoice_image_paths, 1) <= 10);

-- Recreate RPC to include invoice_image_paths
DROP FUNCTION IF EXISTS public.get_warranty_claims(warranty_status, integer);
CREATE OR REPLACE FUNCTION public.get_warranty_claims(
  _status warranty_status DEFAULT NULL,
  _limit integer DEFAULT 200
)
RETURNS TABLE(
  id uuid, user_id uuid, full_name text, email text, avatar_url text,
  active_role app_role, invoice_image_url text, invoice_storage_path text,
  invoice_image_paths text[],
  purchase_at timestamp with time zone, requested_role app_role,
  duration_months integer, permanent boolean, user_note text,
  status warranty_status, admin_note text, reviewed_by uuid,
  reviewed_at timestamp with time zone, created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.id, c.user_id,
    p.full_name, p.email, p.avatar_url,
    COALESCE(ur.role, 'free'::app_role) AS active_role,
    c.invoice_image_url, c.invoice_storage_path, c.invoice_image_paths,
    c.purchase_at, c.requested_role, c.duration_months, c.permanent,
    c.user_note, c.status, c.admin_note, c.reviewed_by, c.reviewed_at, c.created_at
  FROM public.role_warranty_claims c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = c.user_id
  WHERE public.is_admin(auth.uid())
    AND (_status IS NULL OR c.status = _status)
  ORDER BY CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END, c.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$function$;
