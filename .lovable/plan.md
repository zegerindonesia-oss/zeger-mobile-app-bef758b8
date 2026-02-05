
## Rencana Perbaikan: Perbedaan Data Sales Dashboard vs Finance

### Masalah yang Ditemukan

**Root Cause: Supabase 1000 Row Limit**

| Sumber Data | Sales Pak Tri (Jan 2026) | Jumlah Transaksi |
|-------------|--------------------------|------------------|
| Dashboard | 7,316,000 | 346 |
| Operational Expenses | 6,391,000 | 285 |
| Database (actual) | 7,316,000 | 346 |

**Penjelasan:**
- Total transaksi di Januari 2026 adalah **1,194 transaksi**
- Supabase memiliki default limit **1000 rows per query**
- Query di `OperationalExpenses.tsx` tidak menggunakan pagination
- Ketika mengambil 1000 transaksi pertama, Pak Tri hanya mendapat 285 transaksi (bukan 346)
- Ini menyebabkan perbedaan **925,000 IDR** (61 transaksi hilang)

---

### Perubahan pada File: `src/pages/finance/OperationalExpenses.tsx`

#### Perbaikan: Implementasi Pagination untuk Query Transactions

**Lokasi:** fungsi `load()` sekitar baris 210-232

**Sebelum (tanpa pagination):**
```typescript
// Fetch all transactions for the period to calculate omset per rider
const { data: transactions } = await supabase
  .from('transactions')
  .select('rider_id, final_amount')
  .eq('status', 'completed')
  .eq('is_voided', false)
  .gte('transaction_date', startDateTimeStr)
  .lte('transaction_date', endDateTimeStr);
```

**Sesudah (dengan pagination):**
```typescript
// Fetch all transactions with pagination to avoid 1000 row limit
const batchSize = 1000;
let from = 0;
const allTransactions: any[] = [];

while (true) {
  const { data: batch } = await supabase
    .from('transactions')
    .select('rider_id, final_amount')
    .eq('status', 'completed')
    .eq('is_voided', false)
    .gte('transaction_date', startDateTimeStr)
    .lte('transaction_date', endDateTimeStr)
    .range(from, from + batchSize - 1);
  
  if (!batch || batch.length === 0) break;
  allTransactions.push(...batch);
  if (batch.length < batchSize) break;
  from += batchSize;
}

const transactions = allTransactions;
```

---

### Ringkasan Perubahan

| File | Lokasi | Perubahan |
|------|--------|-----------|
| `OperationalExpenses.tsx` | baris 210-232 (fungsi load) | Implementasi pagination untuk query transactions |

### Hasil yang Diharapkan

1. **Data Sales Konsisten** antara Dashboard dan Finance
   - Pak Tri Jan 2026: **7,316,000** (sama di kedua halaman)
2. **Semua transaksi terhitung** - tidak ada yang terpotong karena limit 1000 rows
3. **Persentase beban terhadap omset akurat** karena total omset sekarang benar

### Tidak Ada Perubahan Pada

- Timezone handling (sudah benar menggunakan +07:00)
- Format tanggal (sudah konsisten dengan dashboard)
- RLS policies atau database
- Fitur lain di halaman ini
