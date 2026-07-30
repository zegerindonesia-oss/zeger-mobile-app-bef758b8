## Temuan (sudah diverifikasi)

- File `.env` project **sudah berisi** `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` (nilai valid, 41 karakter) dan `..._TRACKING_ID`. Jadi konektor Google Maps sudah ter-link dengan benar.
- Penyebab peta kosong ada di `vite.config.ts`: blok `define` menimpa `import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` dengan nilai dari `process.env`. Vite memuat `.env` ke `import.meta.env`, **bukan** ke `process.env`. Saat build published, `process.env` tidak berisi variabel tersebut, sehingga `define` meng-hardcode string kosong `''` dan menimpa nilai asli dari `.env` → frontend membaca key kosong → muncul "Peta belum aktif".

## Perbaikan

1. **`vite.config.ts`**
   - Hapus blok `define` untuk variabel Google Maps (biarkan Vite meng-inject sendiri dari `.env`).
   - Jika tetap ingin fallback (mis. `GOOGLE_MAPS_BROWSER_KEY` tanpa prefix VITE), gunakan `loadEnv(mode, process.cwd(), '')` dan hanya definisikan variabel bila hasilnya **tidak kosong**, supaya nilai `.env` tidak pernah tertimpa string kosong.

2. **`src/config/maps.ts`**
   - Tidak perlu diubah; pembacaan key sudah benar.

3. **Verifikasi**
   - Restart dev server, cek bundle/runtime bahwa key tidak kosong.
   - Buka `/customer-app` di URL Lovable preview/published dan pastikan peta + pin rider muncul (bukan overlay "Peta belum aktif").
   - Catatan: di custom domain (mis. zegercoffee.com) managed key tetap tidak akan jalan; itu butuh API key Google Cloud sendiri.
