## Yang harus diklik

Jangan klik **Disable** dan jangan hapus koneksi.

Dari screenshot kamu, posisi sudah benar di halaman **Google Maps Platform**.

Ikuti ini:

1. Di bagian **Connections**, lihat tabel yang ada baris:
   - Name: **Google Maps Platform**
   - Label: **Managed**
   - Type: **App + chat**
   - Projects: **1**
2. Klik langsung **baris Google Maps Platform** itu.
3. Setelah masuk ke halaman detail koneksi, cari tombol/menu:
   - **Reconnect**, atau
   - ikon **titik tiga (⋮)** / dropdown di kanan atas halaman detail koneksi.
4. Kalau ada pilihan, pilih **Reconnect**.
5. Pilih **Lovable-managed Google Maps Platform**.
6. Klik **Connect / Save**.
7. Setelah selesai, reload `/customer-app`.

## Kalau setelah klik baris tetap tidak ada Reconnect

Jangan delete dulu.

Alternatif aman:

1. Klik tombol biru **Add connection** di kanan atas.
2. Pilih / buat koneksi **Lovable-managed Google Maps Platform**.
3. Hubungkan ke project yang sama.
4. Setelah sukses, reload `/customer-app`.

## Yang tidak boleh dilakukan

- Jangan klik **Disable**.
- Jangan hapus connection lama dulu.
- Jangan masukkan API key manual di chat.

Tujuannya hanya membuat Lovable meng-inject ulang Google Maps browser key ke project.