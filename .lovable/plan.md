Saya sudah cek sinyal runtime: koneksi Google Maps sekarang sudah ter-link ke project, tetapi browser masih membaca key sebagai kosong, jadi script Maps tidak pernah dipanggil.

Rencana perbaikan:

1. **Perbaiki sumber key frontend**
   - Update konfigurasi map agar `GOOGLE_MAPS_API_KEY` memakai browser key yang benar dari konektor.
   - Karena konektor saat ini menyediakan secret `$GOOGLE_MAPS_API_KEY`, frontend perlu menerima alias `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` secara eksplisit dari konfigurasi Vite.

2. **Perbaiki fallback konfigurasi Vite**
   - Pastikan `vite.config.ts` memetakan `GOOGLE_MAPS_API_KEY` / `GOOGLE_MAPS_BROWSER_KEY` ke env frontend `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`.
   - Ini membuat app preview/published tidak lagi menampilkan pesan “Google Maps browser key belum aktif”.

3. **Perkuat handling error map**
   - Tetap tampilkan rider list walaupun map gagal.
   - Ubah pesan error supaya jelas apakah masalahnya key kosong, script gagal load, atau Google menolak domain/API.

4. **Verifikasi setelah implementasi**
   - Cek bundle/runtime bahwa key frontend tidak kosong.
   - Buka `/customer-app` dan pastikan area peta tidak lagi menampilkan “Peta belum aktif”.

Catatan penting: saya tidak akan minta API key di chat. Koneksi Google Maps sudah ada; masalahnya sekarang adalah injeksi browser key ke frontend.