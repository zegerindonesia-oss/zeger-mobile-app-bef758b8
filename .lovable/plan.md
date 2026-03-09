

## Rencana: Perbaiki Pendapatan Rider di Branch Hub + Export PDF

### File yang Diubah
`src/pages/finance/RiderIncome.tsx`

### 1. Fix Komisi Penjualan
Saat ini komisi mingguan dibagi 7 per hari (`totalCommission / 7`). Ini salah — komisi penjualan adalah lump sum mingguan. Perbaikan:
- Komisi penjualan ditampilkan sebagai total mingguan di baris hari Minggu (atau hari terakhir minggu dalam filter)
- Hari lain dalam minggu menampilkan Rp 0 untuk kolom komisi penjualan

### 2. Tambah Kolom "Hari"
- Tambah kolom "Hari" setelah "Tanggal" di detail table dan resume tidak perlu
- Format: Senin, Selasa, dst (`toLocaleDateString("id-ID", { weekday: "long" })`)

### 3. Export PDF
- Tombol "Export PDF" di atas tabel resume
- Menggunakan `jspdf` (sudah terinstall)
- **Judul**: "Laporan Pendapatan Rider Zeger Coffee"
- **Sub-judul**: "Periode {tgl mulai} s/d {tgl akhir} {Bulan} {Tahun}"
- Jika filter rider spesifik, nama rider disertakan
- Render kedua tabel (Resume + Detail) secara manual ke PDF landscape A4

### Detail Teknis Perhitungan

```text
Saat ini (SALAH):
  perDay = (weeklyRevenue × rate) / 7   ← dibagi rata per hari

Seharusnya (BENAR):
  salesCommission = weeklyRevenue × rate  ← lump sum
  Ditampilkan hanya di hari terakhir minggu yang masuk filter range
  Hari lain: salesCommission = 0
```

### Yang Tidak Berubah
- Komisi harian tetap Rp 30.000 per hari ada transaksi
- Waste tetap sebagai pengurang
- Resume table tetap menampilkan total aggregated
- Sidebar dan routing tidak berubah

