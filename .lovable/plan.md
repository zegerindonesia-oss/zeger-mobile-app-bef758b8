
## Rencana: Perbaikan Layout Mobile untuk Filter dan Target Progress Card

### Masalah yang Teridentifikasi

Dari screenshot, tampilan pada tab Analytics terpotong di sisi kanan karena:
1. **Filter Period Card**: Layout menggunakan `flex items-center gap-4` yang menyebabkan konten melebar horizontal dan terpotong
2. **TargetProgressCard**: Indikator bulatan di ujung progress bar terpotong karena `overflow-hidden` pada container

### Perubahan yang Akan Dilakukan

#### 1. File: `src/components/mobile/MobileRiderAnalyticsEnhanced.tsx`

**Lokasi**: Baris 407-451 (Filter Period Card)

**Perubahan**:
- Mengubah layout dari `flex items-center gap-4` menjadi `space-y-4` (vertikal)
- Memindahkan custom date range ke luar dari container flex agar tidak nested
- Menggunakan full width untuk dropdown filter

```text
SEBELUM:
┌─────────────────────────────────────────┐
│ [Icon] │ Filter Periode │ [Dropdown...] │  ← Terpotong
└─────────────────────────────────────────┘

SESUDAH:
┌─────────────────────────────────────────┐
│ 🔽 Filter Periode                       │
│ ┌─────────────────────────────────────┐ │
│ │ Kemarin                         ▼   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Dari Tanggal] [Sampai Tanggal]         │  ← Jika custom
└─────────────────────────────────────────┘
```

---

#### 2. File: `src/components/mobile/TargetProgressCard.tsx`

**Lokasi**: Baris 74-94 (Progress Bar Container)

**Perubahan**:
- Menambahkan padding horizontal pada container progress bar (`px-4`) agar ada ruang untuk bulatan indikator
- Mengubah `overflow-hidden` hanya pada inner container, bukan outer
- Menambahkan margin right pada progress bar untuk memberi ruang pada indikator

---

### Ringkasan Perubahan

| File | Perubahan |
|------|-----------|
| `MobileRiderAnalyticsEnhanced.tsx` | Perbaikan layout Filter Card menjadi vertikal dan responsive |
| `TargetProgressCard.tsx` | Tambah padding untuk indikator bulatan tidak terpotong |

### Yang Tidak Berubah

- Semua logika filter dan perhitungan target
- Warna dan gradient yang sudah ada
- Fungsi-fungsi fetching data
- Layout cards lainnya
