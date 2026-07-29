## Jawaban Singkat
Tidak perlu kirim API key lewat chat. API key harus masuk lewat **Google Maps Platform connector Lovable** atau secret/env yang aman. Dari gejala saat ini, masalahnya kemungkinan besar bukan data rider, tapi **frontend belum menerima browser key Maps** atau script Maps gagal load.

## Data yang Dibutuhkan
1. **Tidak perlu API key mentah di chat.**
2. Yang perlu dicek:
   - Google Maps connector sudah linked ke project.
   - Browser key tersedia untuk frontend (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`) atau fallback env yang aman.
   - Domain preview/published masih di domain Lovable, karena managed key hanya berlaku untuk `*.lovable.app` / `*.lovableproject.com`.
   - Minimal ada rider aktif dengan stok dan koordinat fallback/checkpoint supaya pin muncul.

## Rencana Solusi
1. **Validasi koneksi Google Maps**
   - Cek daftar connector Google Maps Platform yang linked.
   - Pastikan connection memakai managed Lovable Google Maps dan project punya akses.

2. **Perbaiki pembacaan key frontend**
   - Update config Maps supaya membaca browser key connector dengan benar.
   - Tambahkan fallback aman untuk env key yang memang tersedia di runtime preview.
   - Jangan pernah menampilkan API key di console atau UI.

3. **Perbaiki loading Maps JavaScript API**
   - Gunakan `loading=async` dan callback readiness yang benar.
   - Hindari membuat map sebelum `google.maps.Map` benar-benar siap.
   - Jika script gagal, tampilkan pesan yang jelas: key belum aktif, domain tidak diizinkan, atau API gagal load.

4. **Validasi data rider untuk pin**
   - Pastikan rider yang punya stok tetap muncul di list.
   - Jika rider belum checkpoint hari ini, pakai fallback lokasi branch/rider agar tetap terlihat sebagai “Siap menerima order”.
   - Jika koordinat kosong, rider tetap tampil di list tetapi tidak dibuat pin.

5. **Verifikasi di preview**
   - Buka `/customer-app`.
   - Pastikan area map bukan abu-abu kosong.
   - Pastikan pin muncul sesuai rider yang punya koordinat.
   - Klik pin memilih rider di list, dan klik rider di list memfokuskan pin di map.

## Jika Setelah Ini Masih Tidak Muncul
- Kalau memakai **custom domain**, managed Google Maps key Lovable tidak bisa dipakai; perlu API key Google Cloud milik sendiri dengan referrer domain custom.
- Kalau tetap di domain Lovable tetapi key belum inject, solusinya reconnect Google Maps Platform connector atau refresh environment project.
- Kalau map muncul tapi pin tidak ada, berarti issue-nya pindah ke data rider/koordinat, bukan Google Maps key.