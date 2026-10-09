INSERT INTO public.subscription_plans (name, description, price, quota, period_days, is_active, tier, is_best, benefits)
SELECT * FROM (VALUES
 ('Signature', 'Paket terlengkap MyZeger Plan', 49000::numeric, 6, 30, true, 'signature', true,
  '[{"title":"Free 1 Cup","subtitle":"1x transaksi/bulan","qty":1},{"title":"Buy 1 Get 1","subtitle":"Berlaku setiap tanggal 25","qty":1},{"title":"Diskon 20%","subtitle":"Maks. Rp15.000 per transaksi","qty":3},{"title":"Happy Birthday Gratis 1 Cup","subtitle":"Di bulan ulang tahunmu","qty":1}]'::jsonb),
 ('Starter', 'Mulai hemat setiap bulan', 24000::numeric, 3, 30, true, 'starter', false,
  '[{"title":"Buy 1 Get 1","subtitle":"Berlaku setiap tanggal 25","qty":1},{"title":"Diskon 20%","subtitle":"Maks. Rp10.000 per transaksi","qty":2}]'::jsonb)
) v(name, description, price, quota, period_days, is_active, tier, is_best, benefits)
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans);