
## Rencana: Perbaikan Waste Management - Reorder, Resume per Rider, dan Export PDF

### Perubahan pada file `src/components/inventory/WasteManagement.tsx`

### 1. Ubah Urutan Section

Urutan saat ini: Filter > Grafik > Input > Laporan

Urutan baru:
1. **Input Product Waste** (dipindah ke atas)
2. **Filter Waste Data** (tetap)
3. **Resume Product Waste** (BARU - tabel ranking per rider)
4. **Grafik Product Waste** (tetap)
5. **Laporan Waste** (tetap + tambah tombol Export PDF)

### 2. Tambah Section "Resume Product Waste" (Baru)

Tabel ranking semua rider dengan kolom:
- No.
- Nama Rider (dengan icon trophy untuk top 3)
- Total Waste (Qty)
- Avg Waste/day (Qty)
- Total Waste (Rp)
- Avg Waste/day (Rp)

Data diambil dari `wasteData` yang sudah di-fetch, di-group berdasarkan `rider_name`, lalu di-sort dari waste terbesar ke terkecil. Avg/day dihitung berdasarkan jumlah hari unik dalam data.

Desain mengikuti referensi screenshot "Top Rank" dengan:
- Border merah/gradient header
- Icon trophy emas/perak/perunggu untuk ranking 1-3
- Badge merah untuk nilai avg waste

### 3. Tambah Export PDF pada Laporan Waste

- Tombol "Export PDF" di header card Laporan Waste
- Menggunakan library `jspdf` yang sudah terinstall
- Mengekspor tabel laporan waste beserta summary total dan rata-rata
- Format: landscape A4, judul "Laporan Waste", periode filter, dan tabel data

### Detail Teknis

| Perubahan | Detail |
|-----------|--------|
| Reorder JSX sections | Pindah Input Form ke posisi pertama dalam return JSX |
| Resume table | Group `wasteData` by `rider_name`, hitung total qty, total waste Rp, avg/day |
| Trophy icons | Import `Trophy` dari lucide-react, warna emas/perak/perunggu untuk rank 1-3 |
| Export PDF | Gunakan `jspdf` yang sudah ada, buat fungsi `handleExportPDF()` |
| Avg/day calculation | Hitung jumlah hari unik dari `created_at`, bagi total dengan jumlah hari |

### Yang Tidak Berubah
- Semua logika fetch data, filter, dan input waste
- Struktur database dan RLS policy
- Komponen UI lainnya
