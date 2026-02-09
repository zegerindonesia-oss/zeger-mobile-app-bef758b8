
## Rencana Perbaikan: Layout Mobile Responsive untuk Analytics

### Masalah yang Ditemukan

Dari screenshot, beberapa elemen terpotong di sisi kanan layar:

1. **TargetProgressCard**: 
   - Headline text terpotong di ujung kanan
   - Progress bar indicator tidak memiliki ruang cukup

2. **Stats Cards (4 kartu grid)**:
   - Layout horizontal (icon + text side-by-side) menyebabkan overflow
   - Currency format panjang seperti "Rp 514.000" tidak wrap dengan benar
   - Cards tidak memiliki `min-w-0` dalam grid layout

### Solusi yang Akan Diterapkan

#### 1. File: `src/components/mobile/TargetProgressCard.tsx`

**Perubahan**:
- Tambah `overflow-hidden` pada Card untuk mencegah overflow keluar container
- Tambah padding ekstra pada progress bar container untuk ruang indicator
- Headline text tetap dengan line height yang baik

#### 2. File: `src/components/mobile/MobileRiderAnalyticsEnhanced.tsx`

**Perubahan pada Stats Cards (baris 461-518)**:

**Sebelum:**
```
┌─────────────────┬─────────────────┐
│ [Icon] Rp 514.000    │ [Icon] 30             │  ← Terpotong
│        Total...      │        Total Transak │
└─────────────────┴─────────────────┘
```

**Sesudah:**
```
┌─────────────────┬─────────────────┐
│  [Icon]         │  [Icon]         │
│  Rp 514.000     │  30             │
│  Total Penjual. │  Total Transaksi│
└─────────────────┴─────────────────┘
```

Perubahan spesifik:
- Ubah layout dari horizontal (`flex items-center gap-3`) ke vertikal (`flex flex-col items-center`)
- Icon dipindah ke atas, centered
- Text dan label di bawah icon, centered
- Tambah `min-w-0` pada Cards untuk mencegah grid overflow
- Currency text menggunakan `text-base` agar lebih compact
- Tambah `truncate` pada text label jika perlu

### Detail Teknis

| File | Perubahan |
|------|-----------|
| `TargetProgressCard.tsx` | Tambah overflow-hidden dan padding yang lebih baik |
| `MobileRiderAnalyticsEnhanced.tsx` | Ubah Stats Cards ke layout vertikal centered |

### Yang Tidak Berubah

- Semua logika perhitungan dan filtering
- Warna dan gradient
- Fungsionalitas lainnya
- Struktur data dan API calls
