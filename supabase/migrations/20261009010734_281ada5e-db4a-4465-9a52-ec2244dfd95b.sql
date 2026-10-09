UPDATE public.promo_banners
SET valid_until = DATE '2027-12-31'
WHERE is_active = true
  AND valid_until IS NOT NULL
  AND valid_until < CURRENT_DATE;

INSERT INTO public.app_settings (setting_key, setting_value, setting_type, is_active)
VALUES ('order.fees', '{"delivery_fee": 25400, "delivery_discount_percent": 20, "takeaway_charge": 3500}'::jsonb, 'customer_app', true)
ON CONFLICT (setting_key) DO NOTHING;