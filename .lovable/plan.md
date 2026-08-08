# Perbaikan: Gagal Menyimpan Reward Loyalty

## Akun admin (Head Office)
Ada 2 akun dengan role `ho_admin`:
- zeger.indonesia@gmail.com (zeger.indonesia)
- niekayu@gmail.com (Zeger_Admin)

Kalau password lupa, reset lewat dashboard Supabase (Authentication > Users). Tapi login admin sebenarnya tidak perlu — lihat di bawah.

## Penyebab error
Aturan akses tabel `loyalty_rewards` dan `loyalty_tiers` saat ini hanya mengizinkan role Head Office (`ho_admin`, `1_HO_Admin`, `1_HO_Owner`) untuk menambah/mengubah/menghapus. Akun yang dipakai sekarang Branch Hub Manager, sehingga penyimpanan ditolak: "new row violates row-level security policy". Upload foto sendiri sudah diizinkan (bucket `loyalty-images` punya kebijakan upload untuk staf) — yang gagal adalah penyimpanan data reward-nya.

## Yang akan dikerjakan
1. Perbarui aturan akses `loyalty_rewards` dan `loyalty_tiers` agar Branch Hub Manager dan Small Branch Manager juga bisa menambah, mengubah, dan menghapus reward/tier — selain Head Office. Pelanggan tetap hanya bisa melihat reward aktif.
2. Pastikan hak akses tabel untuk pengguna login lengkap agar permintaan tidak ditolak di level API.
3. Uji simpan reward baru (dengan gambar) dari akun Branch Hub Manager.

## Catatan teknis
- Ganti policy `HO can manage loyalty rewards` / `HO can manage loyalty tiers` dengan policy `FOR ALL TO authenticated` yang menambahkan `branch_manager`, `2_Hub_Branch_Manager`, `sb_branch_manager`, `3_SB_Branch_Manager` via `has_role`.
- Tambah GRANT SELECT/INSERT/UPDATE/DELETE ke `authenticated` dan ALL ke `service_role`.
- Tidak ada perubahan kode frontend `LoyaltyManagement.tsx`.