## Masalah

Console preview menunjukkan: "Google Maps browser key belum aktif". Hasil pengecekan:

- Koneksi Google Maps Platform **masih terhubung** ke project (`linked: yes`).
- File `.env` di sandbox **berisi** `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` (41 karakter) dan dev server men-inject-nya dengan benar.
- Tapi bundle yang dipakai preview (`/assets/index-O-LYKCmG.js`) **tidak membawa key** tersebut.

Artinya masalahnya bukan di kode komponen peta, melainkan key hanya tersedia saat dev (dari `.env`) dan tidak selalu ikut ter-inject saat build preview/published. Itu sebabnya peta sempat muncul lalu hilang lagi setelah build ulang.

## Solusi: jangan bergantung hanya pada env build

Tambahkan lapisan fallback runtime, sehingga key selalu didapat baik di dev maupun build.

1. **Edge function baru `get-maps-key`** (public, tanpa JWT)
   - Membaca key browser dari environment connector di sisi server dan mengembalikannya sebagai JSON.
   - Aman: key browser sudah dibatasi HTTP referrer ke domain `*.lovable.app` / `*.lovableproject.com`.

2. **Update `src/config/maps.ts`**
   - Ubah dari konstanta statis menjadi loader async: `getGoogleMapsKey()`.
   - Urutan sumber: `import.meta.env` (dev/build jika ada) → hasil `get-maps-key` (fallback) → gagal.
   - Cache hasilnya di memori supaya hanya sekali fetch per sesi.
   - Tetap sediakan `buildMapsScriptUrl()` yang memakai key hasil loader.

3. **Update pemakai peta**
   - `src/components/customer/CustomerMap.tsx`: state `mapsKeyReady`; tampilkan placeholder "Peta belum aktif" hanya jika loader benar-benar gagal, bukan saat env kosong.
   - `src/components/customer/CustomerOrderTracking.tsx`: pakai loader yang sama.

4. **Verifikasi**
   - Deploy edge function, lalu cek di browser preview bahwa script Maps ter-load dan pin rider muncul.

## Catatan teknis

- `vite.config.ts` tetap dibiarkan seperti sekarang (tidak merugikan; berfungsi saat env tersedia).
- Tidak ada perubahan pada logika data rider / `get-nearby-riders`.
