## Situasi

Koneksi Google Maps Platform sudah kamu hapus. Sekarang project tidak punya browser key Maps, jadi peta di app customer pasti kosong sampai koneksi dibuat ulang.

## Rencana

1. Saya buka kartu **Connect Google Maps Platform** langsung di chat (tool connector Lovable), jadi kamu tidak perlu cari tombol di halaman Connectors.
2. Di kartu itu kamu klik **Create new connection**, lalu pilih opsi **Lovable-managed** (bukan bring-your-own API key).
3. Setelah kamu selesai, saya verifikasi:
   - koneksi terlink ke project ini,
   - env `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` kembali tersedia di build frontend.
4. Saya restart dev server dan cek `/customer-app` lewat Playwright untuk memastikan peta benar-benar render (bukan kotak abu-abu), lalu laporkan hasilnya.
5. Kalau setelah reconnect peta masih gagal, saya baca error overlay/console dari halaman map dan perbaiki sisi kode loader-nya.

## Catatan teknis

- Tidak ada perubahan kode yang direncanakan kecuali langkah 5 dibutuhkan.
- Kamu tidak perlu mengirim API key apa pun ke chat.
- Managed key hanya valid di domain `*.lovable.app` / `*.lovableproject.com`. Untuk custom domain nanti perlu API key Google Cloud sendiri dengan allowlist domain.