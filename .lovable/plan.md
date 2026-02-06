
## Rencana: Tambah Tabel Target Progress di Dashboard dan Analytics Rider

### Fitur yang Akan Ditambahkan

Menambahkan komponen **Target Progress Card** di bagian **paling atas** pada:
1. Tab **Dashboard** (MobileRiderDashboard.tsx)
2. Tab **Analytics** (MobileRiderAnalyticsEnhanced.tsx)

### Spesifikasi Target

| Filter | Target Omset |
|--------|--------------|
| Hari Ini (today/yesterday) | Rp 500.000 |
| Minggu Ini (weekly) | Rp 3.500.000 |
| Bulan Ini (monthly) | Rp 15.000.000 |
| Custom | Dihitung proporsional berdasarkan jumlah hari |

### Desain Komponen

```text
┌─────────────────────────────────────────────────────────┐
│  Bismillah Allah mudahkan, Yuk Semangat Capai Targetmu │
│                                                         │
│  Tabel Progress Omset                                   │
│                                                         │
│  🎯 90%                                                 │
│  ███████████████████░░░  (progress bar merah)          │
│                                                         │
│  Omset Saat Ini: Rp 450.000                            │
│  Target: Rp 500.000                                     │
└─────────────────────────────────────────────────────────┘
```

---

### Perubahan File

#### 1. File Baru: `src/components/mobile/TargetProgressCard.tsx`

Membuat komponen reusable yang dapat digunakan di Dashboard dan Analytics.

**Props:**
- `currentSales: number` - Total penjualan saat ini
- `filterPeriod: string` - Filter periode yang aktif ('today', 'weekly', 'monthly', dll)
- `startDate?: string` - Tanggal mulai (untuk custom)
- `endDate?: string` - Tanggal akhir (untuk custom)

**Logika Target:**
```typescript
const getTarget = (period: string, startDate?: string, endDate?: string) => {
  const DAILY_TARGET = 500000;
  const WEEKLY_TARGET = 3500000;
  const MONTHLY_TARGET = 15000000;
  
  switch (period) {
    case 'today':
    case 'yesterday':
      return DAILY_TARGET;
    case 'weekly':
      return WEEKLY_TARGET;
    case 'monthly':
      return MONTHLY_TARGET;
    case 'custom':
      // Hitung jumlah hari, target = jumlah hari x 500.000
      if (startDate && endDate) {
        const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        return days * DAILY_TARGET;
      }
      return DAILY_TARGET;
    default:
      return DAILY_TARGET;
  }
};
```

**Komponen UI:**
- Card dengan gradient merah (tema Zeger)
- Motivational text di atas
- Persentase pencapaian yang besar dan jelas
- Progress bar dengan warna merah
- Omset saat ini dan target

---

#### 2. Modifikasi: `src/components/mobile/MobileRiderDashboard.tsx`

**Lokasi:** Setelah Sound Enable Banner (baris ~1108), sebelum GPS Status Card (baris ~1110)

**Perubahan:**
- Import TargetProgressCard component
- Tambahkan komponen TargetProgressCard dengan props:
  - `currentSales={stockCardStats.totalSales}`
  - `filterPeriod={stockCardFilter}`
  - `startDate` dan `endDate` dari custom date jika ada

---

#### 3. Modifikasi: `src/components/mobile/MobileRiderAnalyticsEnhanced.tsx`

**Lokasi:** Setelah Filter Period Card (baris ~451), sebelum Sales Overview cards (baris ~454)

**Perubahan:**
- Import TargetProgressCard component
- Tambahkan komponen TargetProgressCard dengan props:
  - `currentSales={analytics.todaySales}`
  - `filterPeriod={filterPeriod}`
  - `startDate` dan `endDate` dari state yang ada

---

### Ringkasan Perubahan

| File | Aksi | Deskripsi |
|------|------|-----------|
| `src/components/mobile/TargetProgressCard.tsx` | **CREATE** | Komponen baru untuk target progress |
| `src/components/mobile/MobileRiderDashboard.tsx` | **MODIFY** | Import dan tambahkan TargetProgressCard setelah banner |
| `src/components/mobile/MobileRiderAnalyticsEnhanced.tsx` | **MODIFY** | Import dan tambahkan TargetProgressCard setelah filter |

### Yang Tidak Berubah

- Semua logika dan fungsi yang sudah ada
- Filter functionality
- Data fetching
- Layout cards lainnya
- Navigasi dan tab switching

### Hasil yang Diharapkan

1. **Target Progress Card** muncul di paling atas Dashboard dan Analytics
2. **Progress bar merah** yang mengikuti tema Zeger
3. **Persentase dinamis** yang berubah sesuai filter (harian 90%, mingguan 50%, dll)
4. **Motivational text** "Bismillah Allah mudahkan, Yuk Semangat Capai Targetmu"
5. **Responsive** dan sesuai dengan desain mobile app yang ada
