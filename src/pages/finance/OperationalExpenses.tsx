import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

type Expense = {
  id: string;
  expense_category: string;
  amount: number;
  description: string | null;
  expense_date: string;
}

export default function OperationalExpenses() {
  const [category, setCategory] = useState("rent");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<Expense[]>([]);

  const load = async () => {
    // Load operational_expenses only for now to avoid relationship errors
    const { data, error } = await supabase
      .from('operational_expenses')
      .select('id, expense_category, amount, description, expense_date, created_by')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      toast.error(error.message);
    }

    // Also load rider expenses separately
    const { data: riderExpenses } = await supabase
      .from('daily_operational_expenses')
      .select('id, expense_type, amount, description, expense_date, rider_id')
      .order('created_at', { ascending: false })
      .limit(10);

    // Combine the data
    const combinedExpenses = [
      ...(data || []).map(item => ({
        id: item.id,
        expense_category: item.expense_category,
        amount: item.amount,
        description: item.description,
        expense_date: item.expense_date,
        source: 'operational'
      })),
      ...(riderExpenses || []).map(item => ({
        id: item.id,
        expense_category: item.expense_type,
        amount: item.amount,
        description: `${item.description} (Rider Expense)`,
        expense_date: item.expense_date,
        source: 'rider'
      }))
    ].sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());

    setItems(combinedExpenses as Expense[]);
  };

  useEffect(() => { load(); }, []);

  const onAdd = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Jumlah tidak valid');
      return;
    }
    const { error } = await supabase.from('operational_expenses').insert({
      expense_category: category,
      amount: amt,
      description: description || null
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Beban ditambahkan');
    setAmount(""); setDescription("");
    load();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Beban Operasional</h1>
        <p className="text-muted-foreground">Catat beban biaya: sewa, listrik, gaji, dll</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Tambah Beban</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rent">Sewa</SelectItem>
                <SelectItem value="utilities">Listrik/Air</SelectItem>
                <SelectItem value="salary">Gaji</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="maintenance">Perawatan</SelectItem>
                <SelectItem value="other">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Jumlah</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="cth: 1500000" />
          </div>
          <div className="md:col-span-2">
            <Label>Keterangan</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opsional" />
          </div>
          <div className="md:col-span-4">
            <Button onClick={onAdd}>Simpan</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Riwayat (Termasuk Beban Rider)</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {items.map(it => (
              <div key={it.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium capitalize flex items-center gap-2">
                    {it.expense_category}
                    {(it as any).source === 'rider' && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Rider</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{it.description || '-'}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{currency.format(it.amount || 0)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(it.expense_date).toLocaleDateString('id-ID')}</div>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground">Belum ada data.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
