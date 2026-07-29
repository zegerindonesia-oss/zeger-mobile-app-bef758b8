## Masalah
Console error: "Google Maps browser key belum aktif". Artinya env `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` masih kosong di runtime — connector Google Maps belum meng-inject browser key ke project.

## Solusi (1 langkah)
**Reconnect Google Maps Platform connector.**

Saya akan panggil `standard_connectors--reconnect` untuk connector `google_maps`. Kamu tinggal klik **Reconnect** di kartu yang muncul di chat, pilih koneksi **Lovable-managed Google Maps Platform**, dan selesai. Setelah itu:

1. Browser key (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`) akan ter-inject ke build.
2. Preview akan otomatis rebuild.
3. Buka `/customer-app` → peta muncul dengan pin rider.

## Kalau setelah reconnect masih blank
Berarti bukan masalah key. Kemungkinan:
- Kamu buka lewat **custom domain** (bukan `*.lovable.app`) → managed key tidak berlaku, harus pakai API key Google Cloud sendiri.
- Belum ada rider dengan checkpoint hari ini + stok > 0 → peta muncul tapi tanpa pin.

Kalau plan ini oke, approve dan saya langsung trigger reconnect card-nya.
