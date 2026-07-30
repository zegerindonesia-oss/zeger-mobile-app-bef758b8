## Perbaikan tombol Direction

**Masalah terkonfirmasi:** URL tujuan sudah benar, tetapi tombol membuat tab dari dalam iframe preview Lovable. Tab tersebut mewarisi sandbox tanpa izin navigasi eksternal, sehingga Google Maps diblokir dengan `ERR_BLOCKED_BY_RESPONSE`.

1. Ubah handler Direction di `CustomerMap.tsx` menjadi navigasi eksternal tingkat atas (`window.top`) saat aplikasi berjalan di dalam preview iframe.
2. Saat aplikasi dibuka langsung/published, gunakan tautan Google Maps universal yang membuka aplikasi Google Maps di perangkat mobile atau halaman Maps di browser desktop.
3. Terapkan handler yang sama pada ikon Direction di kartu rider dan halaman detail rider.
4. Tambahkan fallback aman bila browser memblokir akses parent/top-level.
5. Verifikasi klik Direction dari `/customer-app`: URL berisi koordinat rider dan halaman aplikasi tidak berubah menjadi blank.