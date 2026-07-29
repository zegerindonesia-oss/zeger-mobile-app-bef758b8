## Diagnosis
Peta tidak muncul karena runtime browser melempar error: `Google Maps API key belum dikonfigurasi`. Saya sudah cek koneksi Google Maps Platform: koneksinya linked ke project, tetapi environment browser `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` tidak tersedia; yang tersedia hanya key server/gateway.

## Rencana Perbaikan
1. **Perbaiki config Google Maps frontend**
   - Buat `src/config/maps.ts` lebih robust agar membaca browser key dari env yang benar.
   - Tambahkan fallback aman untuk preview jika connector hanya menyediakan key Google Maps yang tersedia di sandbox.

2. **Perbaiki UX saat key belum tersedia**
   - Jangan biarkan area map hanya abu-abu kosong.
   - Tampilkan pesan jelas bahwa Google Maps key belum aktif/terinject jika key tetap kosong.

3. **Pastikan script Maps dimuat dengan benar**
   - Tetap pakai `loading=async`.
   - Pastikan map hanya dibuat setelah library Maps benar-benar siap.

4. **Verifikasi**
   - Buka `/customer-app` di preview mobile.
   - Pastikan tidak ada error Google Maps key di console.
   - Pastikan area map tampil, dan pin rider tetap dibuat dari data rider yang punya koordinat.

## Catatan
Jika setelah perbaikan key browser tetap tidak tersedia karena connector managed belum menyuntikkan public browser key, perlu reconnect Google Maps connector atau refresh environment project. Namun kode akan dibuat lebih jelas supaya penyebabnya tidak tampak seperti bug UI.