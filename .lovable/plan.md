## Fix Map Rider di App Customer

**Keputusan:**
- Strategi lokasi: **checkpoint-based** — lokasi & status rider hanya update saat rider check-in di app rider.
- Google Maps: pakai **connector Lovable managed** (key otomatis provisioned untuk `*.lovable.app`).

---

### Langkah

**1. Connect Google Maps Platform connector**
- Panggil `standard_connectors--connect` dengan `connector_id: google_maps`.
- Setelah tersambung, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` tersedia otomatis di frontend.

**2. Ganti hardcoded key**
- Hapus key hardcoded di `src/config/maps.ts`.
- Ganti dengan `import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`.
- Tambah fallback error message yang jelas kalau env var kosong (belum di-connect).

**3. Pastikan semua loader Maps pakai parameter yang benar**
- Update loader script di `CustomerMap.tsx` (dan komponen lain yang load Maps JS) supaya:
  - Pakai `loading=async`
  - Pakai `callback=initMap` (window global callback)
  - Tambah `channel=${VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID}` untuk tracking
- Pastikan pakai `google.maps.Marker` (bukan `AdvancedMarkerElement` yang butuh `mapId`).
- Jangan set `mapId` di constructor `Map`.

**4. Konfirmasi strategi checkpoint sudah aktif**
- Verifikasi `get-nearby-riders` edge function sudah return lokasi dari **checkpoint terakhir hari ini** (bukan `profiles.last_known_lat/lng` live).
- Kalau masih pakai `last_known_lat/lng`, ubah sumber ke tabel checkpoint (`rider_checkpoints` atau sejenis) dengan filter tanggal hari ini (Asia/Jakarta) + ambil row `created_at` terbaru per rider.
- Rider tanpa checkpoint hari ini → tidak muncul di map.

**5. Tidak menyentuh live tracking**
- `update-rider-location-live` dibiarkan (tidak dipakai untuk map customer, tapi tetap ada untuk fitur lain kalau perlu).
- Kalau kamu mau saya matikan sekalian di app rider (hemat baterai), bilang setelah plan disetujui.

### Technical Details

**File yang diubah:**
- `src/config/maps.ts` — swap ke env var
- `src/components/customer/CustomerMap.tsx` — update loader Maps JS + pastikan `google.maps.Marker`
- `supabase/functions/get-nearby-riders/index.ts` — verify/ubah sumber lokasi ke checkpoint terakhir hari ini

**Verifikasi:**
- Buka `/customer-app` di preview, cek map render (tidak ada dialog "Halaman ini tidak dapat memuat Google Maps").
- Cek console: tidak ada error `RefererNotAllowedMapError` / `InvalidKeyMapError`.
- Cek rider dengan checkpoint hari ini muncul; rider tanpa checkpoint tidak muncul.
