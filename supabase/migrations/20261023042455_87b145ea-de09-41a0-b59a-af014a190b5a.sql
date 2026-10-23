REVOKE EXECUTE ON FUNCTION public.member_benefits(uuid) FROM anon, public;
CREATE OR REPLACE FUNCTION public.member_benefits(_member_id uuid)
 RETURNS TABLE(id uuid, code text, reward_name text, status text, discount_type text, discount_value numeric,
   max_discount numeric, min_transaction numeric, expires_at timestamptz, used_at timestamptz, product_id uuid, image_url text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT lr.id, lr.code, lr.reward_name,
    CASE WHEN lr.status = 'active' AND lr.expires_at IS NOT NULL AND lr.expires_at < now() THEN 'expired' ELSE lr.status END,
    lr.discount_type, lr.discount_value, lr.max_discount, lr.min_transaction, lr.expires_at, lr.used_at,
    lr.product_id, rw.image_url
  FROM public.loyalty_redemptions lr
  LEFT JOIN public.loyalty_rewards rw ON rw.id = lr.reward_id
  WHERE lr.member_id = _member_id
    AND (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.customer_users c WHERE c.id = _member_id AND c.user_id = auth.uid()))
  ORDER BY (lr.status = 'active' AND (lr.expires_at IS NULL OR lr.expires_at >= now())) DESC, lr.created_at DESC
  LIMIT 30;
$function$;