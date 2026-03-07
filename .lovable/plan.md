

## Rencana: Tambah Halaman Pendapatan Rider di Finance

### Skema Komisi Rider (dari gambar referensi)
- **Komisi Harian (Kehadiran)**: Rp 30.000/hari (berdasarkan attendance)
- **Komisi Penjualan (Mingguan)**: Berdasarkan tiering % x total omset mingguan
  - < Rp 1.000.000: 0%
  - Rp 1.000.000: 7%
  - Rp 1.500.000: 10%
  - Rp 2.000.000: 11%
  - Rp 2.500.000: 13%
  - Rp 3.000.000: 14%
  - Rp 3.500.000: 15%
  - Rp 4.000.000: 15.5%
  - Rp 4.500.000: 16%
  - Rp 5.000.000: 16.5%
  - Rp 5.500.000: 17%
  - Rp 6.000.000+: 17.5%
- **Waste**: Pengurang dari total pendapatan rider

### Perubahan yang Dilakukan

#### 1. Buat halaman baru: `src/pages/finance/RiderIncome.tsx`

**Section 1 - Filter:**
- Filter nama rider (Select dari profiles dengan role rider di branch)
- Filter periode: Hari Ini, Kemarin, Minggu Ini, Bulan Ini, Custom date range

**Section 2 - Resume All Rider (Top Rank Table):**
| No | Nama Rider | Komisi Harian | Komisi Penjualan | Waste (-) | Total Pendapatan |
|----|------------|---------------|------------------|-----------|------------------|
| 1  | z-005      | Rp xxx        | Rp xxx           | Rp xxx    | Rp xxx           |

- Sorted by total pendapatan descending
- Trophy icons untuk top 3
- Gradient header merah

**Section 3 - Detail Pendapatan Rider:**
| Tanggal | Nama Rider | Komisi Harian | Komisi Penjualan | Waste (-) | Total Pendapatan |
|---------|------------|---------------|------------------|-----------|------------------|

- Detail per hari per rider
- Komisi harian: Rp 30.000 jika ada record attendance pada hari tersebut
- Komisi penjualan: Dihitung per minggu (Senin-Minggu), lalu dibagi rata per hari dalam minggu tersebut yang masuk dalam filter
- Waste: Dari tabel `product_waste`, sum `total_waste` per rider per hari

**Logika Perhitungan:**

Data sources:
- `attendance` table: Menentukan hari kerja rider (Rp 30.000/hari hadir)
- `transactions` table: Omset mingguan per rider (status completed, is_voided false)
- `product_waste` table: Total waste value per rider per periode

Komisi penjualan dihitung per minggu kalender (Mon-Sun):
1. Sum semua transaksi rider dalam minggu tersebut
2. Cari tier yang sesuai dari tiering table
3. Hitung: omset_mingguan × tier_percentage

#### 2. Update Sidebar: `src/components/layout/ModernSidebar.tsx`

Tambah sub-menu di Finance:
```
Finance
  ├── Laba Rugi
  ├── Arus Kas
  ├── Neraca
  ├── Beban Operasional
  └── Pendapatan Rider (BARU)
```

#### 3. Update Routes: `src/App.tsx`

Tambah route `/finance/rider-income` dengan RoleBasedRoute untuk roles: ho_admin, branch_manager, sb_branch_manager, finance.

### Detail Teknis

| Item | Detail |
|------|--------|
| Data attendance | Query `attendance` table, count hari dengan check_in_time per rider |
| Data omset | Query `transactions` table, group per rider per minggu (Mon-Sun) |
| Tiering | Hardcoded array of tiers, cari tier tertinggi yang omset >= threshold |
| Waste | Query `product_waste` table, sum `total_waste` per rider |
| Branch filter | Auto-filter berdasarkan `get_current_user_branch()` via userProfile.branch_id |
| Currency format | `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })` |

### Yang Tidak Berubah
- Semua halaman finance existing tetap utuh
- Tidak mengubah komponen lain
- Hanya menambah file baru + sidebar entry + route

