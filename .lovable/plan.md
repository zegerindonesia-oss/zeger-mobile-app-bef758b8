

## Rencana: Tambah Laporan Setoran Tunai di App Rider

### Perubahan

#### 1. Buat komponen baru: `src/components/mobile/MobileCashDeposit.tsx`

Komponen read-only (tanpa verifikasi/checkbox) yang menampilkan laporan setoran tunai untuk rider yang sedang login saja. Menggunakan logika yang sama dengan `CashDepositHistory.tsx` tetapi:
- **Tanpa filter rider** — otomatis mengambil data rider yang login (`userProfile.id`)
- **Tanpa checkbox verifikasi** — rider hanya bisa melihat, tidak bisa verify
- **Tanpa kolom Keterangan** — read-only view
- Filter periode: Hari Ini, Kemarin, Minggu Ini, Bulan Ini, Custom
- Resume table (aggregated) + Detail table (per hari)
- Mobile-friendly layout dengan scroll horizontal pada tabel
- Kolom: Tanggal, Total Sales, Penjualan Tunai, QRIS, Transfer Bank, Beban Operasional, Total Setoran Tunai

#### 2. Update `src/components/layout/MobileSidebar.tsx`

Tambah menu item "Setoran Tunai" dengan icon `Wallet` setelah "Waste Report":
```
{ title: "Setoran Tunai", href: "/mobile-seller?tab=cash-deposit", icon: Wallet, key: "cash-deposit" }
```

#### 3. Update `src/pages/MobileSeller.tsx`

Tambah case `cash-deposit` di switch statement yang merender `MobileCashDeposit`.

### Yang Tidak Berubah
- `CashDepositHistory.tsx` untuk branch hub tetap utuh
- Semua komponen dan halaman lain tidak diubah

