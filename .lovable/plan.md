## Perbaikan rider aktif di Customer Map

**Aturan status rider**
- Rider dianggap **aktif dan siap menerima order** ketika profilnya aktif dan memiliki stok rider `> 0` yang sudah diterima.
- Rider tidak wajib checkpoint agar muncul di Customer App.
- Shift tidak dijadikan syarat utama karena penerimaan stok adalah indikator operasional yang dipilih.

**Aturan lokasi**
- Jika ada checkpoint hari ini: gunakan koordinat dan status checkpoint terbaru.
- Jika belum checkpoint: gunakan koordinat branch rider sebagai lokasi sementara.
- Jika branch juga tidak memiliki koordinat: rider tetap dapat ditampilkan di daftar tanpa pin/direction.

**Implementasi**
1. Perbarui Edge Function `get-nearby-riders` agar tidak membuang rider tanpa checkpoint, memfilter rider berdasarkan stok aktual, dan menerapkan fallback lokasi branch.
2. Kembalikan sumber lokasi yang jelas: `checkpoint` atau `branch`, beserta stok menu aktual milik masing-masing rider.
3. Perbarui Customer Map:
   - Status checkpoint: tampilkan nama/status checkpoint.
   - Belum checkpoint: tampilkan **“Siap menerima order • Lokasi sementara: [nama branch]”**.
   - Direction memakai koordinat checkpoint jika tersedia, jika tidak memakai lokasi branch.
4. Verifikasi dengan data saat ini: 7 rider aktif yang memiliki stok harus kembali muncul; rider tanpa stok tidak ditampilkan.
5. Uji Edge Function dan tampilan `/customer-app` pada viewport mobile, termasuk filter radius dan pin/list rider.