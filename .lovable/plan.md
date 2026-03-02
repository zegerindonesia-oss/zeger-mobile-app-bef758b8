
## Rencana: Tambah Report Waste di App Rider (Read-Only)

### Tujuan
Menambahkan tab "Waste Report" di app rider sehingga setiap rider bisa melihat data waste product mereka sendiri, tetapi **hanya bisa melihat (read-only)** - tidak bisa menambah atau mengubah data. Input waste tetap dilakukan dari app Branch Hub Manager.

### Perubahan yang Akan Dilakukan

#### 1. Buat komponen baru: `src/components/mobile/MobileWasteReport.tsx`
- Komponen read-only untuk menampilkan data waste rider
- Filter periode (Hari Ini, Kemarin, Bulan Ini, Custom)
- Tabel laporan waste: tanggal, produk, jumlah, HPP, total waste, alasan
- Summary total dan rata-rata di bawah tabel
- Desain mobile-friendly mengikuti pattern yang sudah ada di MobileRiderAnalyticsEnhanced
- Fetch data dari tabel `product_waste` berdasarkan `rider_id` milik rider yang login
- **Tidak ada form input** - murni tampilan laporan saja

#### 2. Update `src/pages/MobileSeller.tsx`
- Import `MobileWasteReport`
- Tambah case `'waste'` di switch `renderContent()`

#### 3. Update `src/components/layout/MobileSidebar.tsx`
- Tambah menu "Waste Report" dengan icon `Trash2` di navigation items
- Key: `waste`, href: `/mobile-seller?tab=waste`

### RLS Policy
Sudah ada policy "Riders can view own waste" pada tabel `product_waste` yang mengizinkan rider melihat data waste miliknya sendiri. Tidak perlu perubahan database.

### Yang Tidak Berubah
- Alur input waste tetap dari Branch Hub Manager / WasteManagement component
- Tidak ada form input di komponen rider
- Rider tidak bisa edit atau hapus data waste
