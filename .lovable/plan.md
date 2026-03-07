

## Rencana: Tambah Data Master - Product Management

### Analisis Masalah "Produk Tidak Muncul"

Produk baru (Paket Ramadhan, Can Series 330ml, Snack) **sudah ada di database** dan `is_active = true`. Semua query di app menggunakan `.eq('is_active', true)` jadi produk seharusnya muncul. Kemungkinan masalah:
- Cache browser belum refresh
- User belum login ulang setelah menambah produk

Saya akan memastikan produk tampil dengan benar setelah menambahkan fitur Data Master.

### Perubahan yang Akan Dilakukan

#### 1. Buat halaman baru: `src/pages/master/ProductManagement.tsx`

CRUD lengkap untuk produk dengan field:
- **Nama** (text, required)
- **Code** (text, required, auto-generate)
- **Category** (select/input - dari kategori yang ada + tambah baru)
- **Harga Jual / Price** (number)
- **HPP / Cost Price** (number)
- **HPP CK / CK Price** (number)
- **Deskripsi** (textarea)
- **Foto Produk / Image URL** (text input untuk URL)
- **Custom Options** (JSON editor sederhana)
- **Status Aktif** (switch)

Fitur:
- Tabel daftar produk dengan search dan filter kategori
- Dialog form untuk tambah/edit produk
- Tombol aktif/nonaktif produk
- Tombol hapus produk

#### 2. Update Sidebar: `src/components/layout/ModernSidebar.tsx`

Tambah menu "Data Master" setelah "Inventory" dengan sub-menu:
```
Data Master
  └── Product
```

Roles: ho_admin, branch_manager (dan variant level-nya)

#### 3. Update Routes: `src/App.tsx`

Tambah route `/master/products` dengan RoleBasedRoute.

#### 4. RLS Policy

Products sudah punya RLS:
- SELECT: semua authenticated user
- INSERT/UPDATE/DELETE: hanya ho_admin dan 1_HO_Admin

Perlu **tambah branch_manager** ke INSERT/UPDATE policy agar branch manager juga bisa mengelola produk. Atau biarkan hanya HO admin - tergantung kebutuhan.

### Yang Tidak Berubah
- Semua fitur existing tetap utuh
- Tidak mengubah komponen atau halaman yang sudah ada
- Hanya menambah file baru + sidebar entry + route

