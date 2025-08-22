import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TransactionRow {
  id: string;
  transaction_number: string;
  transaction_date: string;
  final_amount: number;
  payment_method: string | null;
  status: string | null;
}

const formatDate = (d: Date) => d.toISOString();

export default function Transactions() {
  const [range, setRange] = useState<'1' | '7' | 'custom'>('7');
  const [from, setFrom] = useState<string>(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'Riwayat Transaksi | Zeger ERP';
  }, []);

  const [startIso, endIso] = useMemo(() => {
    if (range === '1') {
      const start = new Date();
      start.setHours(0,0,0,0);
      return [formatDate(start), formatDate(new Date())];
    }
    if (range === '7') {
      const start = new Date(Date.now() - 7 * 86400000);
      return [formatDate(start), formatDate(new Date())];
    }
    const start = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T23:59:59');
    return [formatDate(start), formatDate(end)];
  }, [range, from, to]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, transaction_number, transaction_date, final_amount, payment_method, status')
          .gte('transaction_date', startIso)
          .lte('transaction_date', endIso)
          .order('transaction_date', { ascending: false });
        if (error) throw error;
        setRows((data as TransactionRow[]) || []);
      } catch (e: any) {
        toast.error('Gagal memuat transaksi: ' + e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [startIso, endIso]);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Riwayat Transaksi</h1>
        <p className="text-sm text-muted-foreground">Filter berdasarkan rentang tanggal</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filter Tanggal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <Select value={range} onValueChange={(v: any) => setRange(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Rentang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Hari Terakhir</SelectItem>
                <SelectItem value="7">7 Hari Terakhir</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {range === 'custom' && (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Dari</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sampai</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hasil ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Transaksi</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.transaction_date).toLocaleString('id-ID')}</TableCell>
                    <TableCell>{t.transaction_number}</TableCell>
                    <TableCell>{t.payment_method || '-'}</TableCell>
                    <TableCell className="text-right">Rp {Number(t.final_amount).toLocaleString('id-ID')}</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">Tidak ada data</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
