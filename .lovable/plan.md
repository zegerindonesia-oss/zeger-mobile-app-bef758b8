
## Rencana Perbaikan

### Masalah yang Ditemukan

#### Masalah 1: Perbedaan Jumlah Beban Operasional Dashboard vs Finance
**Root Cause:**
Dashboard dan Finance menggunakan metode formatting tanggal yang berbeda:
- **Dashboard** menggunakan `formatYMD()` yang mengekstrak langsung dari komponen tanggal (tahun, bulan, hari)
- **Finance** menggunakan `formatDateForQuery()` yang menambahkan offset 7 jam, yang dapat menyebabkan tanggal bergeser ke hari berikutnya

```javascript
// Dashboard - benar
const formatYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Finance - bermasalah (offset bisa geser tanggal)
const formatDateForQuery = (date: Date) => {
  const offset = 7 * 60; // 7 hours in minutes
  const jakartaDate = new Date(date.getTime() + offset * 60 * 1000);
  return jakartaDate.toISOString().split('T')[0];  // BUG: Bisa jadi hari berikutnya
};
```

#### Masalah 2: Perlu Tabel Summary All User
User meminta tabel yang menampilkan semua rider dan total beban operasional per rider, ditampilkan secara default saat filter "all" dipilih.

---

### Perubahan pada File: `src/pages/finance/OperationalExpenses.tsx`

#### Fix 1: Perbaiki Formatting Tanggal (Timezone Issue)

**Perubahan di `formatDateForQuery` function (baris 99-104):**

```typescript
// SEBELUM (bermasalah):
const formatDateForQuery = (date: Date) => {
  const offset = 7 * 60;
  const jakartaDate = new Date(date.getTime() + offset * 60 * 1000);
  return jakartaDate.toISOString().split('T')[0];
};

// SESUDAH (benar - konsisten dengan dashboard):
const formatDateForQuery = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
```

**Perubahan di `formatDateForDB` function (baris 208-212 dan 265-269):**

```typescript
// SEBELUM (bermasalah):
const formatDateForDB = (date: Date) => {
  const offset = 7 * 60;
  const jakartaDate = new Date(date.getTime() + offset * 60 * 1000);
  return jakartaDate.toISOString().split('T')[0];
};

// SESUDAH (benar):
const formatDateForDB = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
```

---

#### Fix 2: Tambah Tabel Summary All User

**Lokasi: Setelah card "Resume Total Beban" (sekitar baris 502)**

Tambahkan komponen tabel ringkasan yang menampilkan:
- Nomor urut
- Nama Rider
- Total Beban Operasional per rider
- Ditampilkan ketika filter user = "all"

**State baru yang diperlukan:**
```typescript
const [userSummary, setUserSummary] = useState<{riderId: string, riderName: string, totalExpenses: number}[]>([]);
```

**Modifikasi fungsi `load()` untuk menghitung summary per user:**
```typescript
// Setelah combine data, hitung summary per rider
if (selectedUser === "all") {
  const summaryMap: { [key: string]: { name: string; total: number } } = {};
  
  // Aggregate dari rider expenses
  (riderExpenses || []).forEach(exp => {
    const rider = riders.find(r => r.id === exp.rider_id);
    if (rider) {
      if (!summaryMap[exp.rider_id]) {
        summaryMap[exp.rider_id] = { name: rider.full_name, total: 0 };
      }
      summaryMap[exp.rider_id].total += Number(exp.amount || 0);
    }
  });
  
  // Aggregate dari operational expenses
  (data || []).forEach(exp => {
    const user = allUsers.find(u => u.id === exp.created_by);
    if (user) {
      if (!summaryMap[exp.created_by]) {
        summaryMap[exp.created_by] = { name: user.full_name, total: 0 };
      }
      summaryMap[exp.created_by].total += Number(exp.amount || 0);
    }
  });
  
  const summaryArray = Object.entries(summaryMap)
    .map(([riderId, data]) => ({
      riderId,
      riderName: data.name,
      totalExpenses: data.total
    }))
    .sort((a, b) => b.totalExpenses - a.totalExpenses);
  
  setUserSummary(summaryArray);
} else {
  setUserSummary([]);
}
```

**UI Tabel Summary (setelah Resume Total Beban):**
```tsx
{/* Tabel Summary per User - ditampilkan jika filter = all */}
{selectedUser === "all" && userSummary.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle>Ringkasan Beban per User</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-semibold">No.</th>
              <th className="text-left p-3 font-semibold">Nama</th>
              <th className="text-right p-3 font-semibold">Total Beban Operasional</th>
            </tr>
          </thead>
          <tbody>
            {userSummary.map((item, index) => (
              <tr key={item.riderId} className="border-b hover:bg-muted/30">
                <td className="p-3">{index + 1}</td>
                <td className="p-3">{item.riderName}</td>
                <td className="p-3 text-right font-medium text-red-600">
                  {currency.format(item.totalExpenses)}
                </td>
              </tr>
            ))}
            {/* Total Row */}
            <tr className="bg-muted/50 font-bold">
              <td colSpan={2} className="p-3 text-right">Total</td>
              <td className="p-3 text-right text-red-600">
                {currency.format(totalExpenses)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
)}
```

---

### Ringkasan Perubahan

| File | Lokasi | Perubahan |
|------|--------|-----------|
| `OperationalExpenses.tsx` | baris 99-104 | Fix `formatDateForQuery` - gunakan komponen tanggal langsung |
| `OperationalExpenses.tsx` | baris 208-212, 265-269 | Fix `formatDateForDB` - gunakan komponen tanggal langsung |
| `OperationalExpenses.tsx` | baru (state) | Tambah state `userSummary` |
| `OperationalExpenses.tsx` | fungsi `load()` | Tambah kalkulasi summary per user |
| `OperationalExpenses.tsx` | setelah baris 502 | Tambah UI tabel summary |

### Hasil yang Diharapkan
1. **Dashboard dan Finance menampilkan jumlah yang sama** untuk beban operasional (contoh: Pak Tri 1-31 Jan 2026)
2. **Tabel ringkasan per user** muncul ketika filter = "Semua User" menampilkan:
   - Nomor urut
   - Nama rider/user
   - Total beban operasional masing-masing
   - Total keseluruhan di baris terakhir

### Tidak Ada Perubahan Pada
- Fitur lain di Finance
- Dashboard atau halaman lainnya
- RLS policies atau database
