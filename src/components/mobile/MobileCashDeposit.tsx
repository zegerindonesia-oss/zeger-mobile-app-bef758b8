import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, Calendar, TrendingUp, Banknote, CreditCard, ArrowDownUp } from "lucide-react";
import { Profile } from "@/lib/types";

interface MobileCashDepositProps {
  userProfile: Profile;
}

interface DepositRow {
  date: string;
  total_sales: number;
  cash_sales: number;
  qris_sales: number;
  transfer_sales: number;
  operational_expenses: number;
  cash_deposit: number;
}

const MobileCashDeposit = ({ userProfile }: MobileCashDepositProps) => {
  const [dateFilter, setDateFilter] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(false);

  const formatYMD = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getDateRange = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (dateFilter) {
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        startDate = y;
        endDate = y;
        break;
      }
      case 'this_week': {
        const ws = new Date(now);
        ws.setDate(ws.getDate() - ws.getDay());
        startDate = ws;
        break;
      }
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
        } else return null;
        break;
      default:
        startDate = new Date(now);
        break;
    }

    return { startYMD: formatYMD(startDate), endYMD: formatYMD(endDate) };
  };

  const fetchData = async () => {
    const range = getDateRange();
    if (!range) return;

    setLoading(true);
    try {
      const riderId = userProfile.id;
      const { startYMD, endYMD } = range;

      const [txRes, expRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('transaction_date, final_amount, payment_method')
          .eq('rider_id', riderId)
          .eq('status', 'completed')
          .eq('is_voided', false)
          .gte('transaction_date', `${startYMD}T00:00:00+07:00`)
          .lte('transaction_date', `${endYMD}T23:59:59+07:00`),
        supabase
          .from('daily_operational_expenses')
          .select('expense_date, amount')
          .eq('rider_id', riderId)
          .gte('expense_date', startYMD)
          .lte('expense_date', endYMD)
      ]);

      if (txRes.error) throw txRes.error;
      if (expRes.error) throw expRes.error;

      const dayMap = new Map<string, DepositRow>();

      txRes.data?.forEach(tx => {
        const date = new Date(tx.transaction_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        if (!dayMap.has(date)) {
          dayMap.set(date, { date, total_sales: 0, cash_sales: 0, qris_sales: 0, transfer_sales: 0, operational_expenses: 0, cash_deposit: 0 });
        }
        const row = dayMap.get(date)!;
        row.total_sales += tx.final_amount;
        if (tx.payment_method === 'cash') row.cash_sales += tx.final_amount;
        else if (tx.payment_method === 'qris') row.qris_sales += tx.final_amount;
        else if (tx.payment_method === 'bank_transfer') row.transfer_sales += tx.final_amount;
      });

      expRes.data?.forEach(exp => {
        const row = dayMap.get(exp.expense_date);
        if (row) row.operational_expenses += Number(exp.amount);
      });

      dayMap.forEach(row => {
        row.cash_deposit = row.cash_sales - row.operational_expenses;
      });

      setDeposits(Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal memuat data setoran tunai');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter, userProfile.id]);

  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
  const fmtDate = (s: string) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(s));

  const totals = useMemo(() => deposits.reduce((a, c) => ({
    total_sales: a.total_sales + c.total_sales,
    cash_sales: a.cash_sales + c.cash_sales,
    qris_sales: a.qris_sales + c.qris_sales,
    transfer_sales: a.transfer_sales + c.transfer_sales,
    operational_expenses: a.operational_expenses + c.operational_expenses,
    cash_deposit: a.cash_deposit + c.cash_deposit,
  }), { total_sales: 0, cash_sales: 0, qris_sales: 0, transfer_sales: 0, operational_expenses: 0, cash_deposit: 0 }), [deposits]);

  return (
    <div className="p-4 space-y-4 bg-gradient-to-br from-white via-red-50/30 to-white min-h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-red-600" />
        <h2 className="text-lg font-semibold">Laporan Setoran Tunai</h2>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div>
            <Label className="text-xs">Periode</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="yesterday">Kemarin</SelectItem>
                <SelectItem value="this_week">Minggu Ini</SelectItem>
                <SelectItem value="this_month">Bulan Ini</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dateFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Dari</Label>
                <Input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Sampai</Label>
                <Input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="h-9" />
              </div>
            </div>
          )}
          {dateFilter === 'custom' && (
            <Button size="sm" onClick={fetchData} disabled={loading} className="w-full">
              <Calendar className="w-4 h-4 mr-2" /> Tampilkan
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Total Sales</p>
            <p className="text-sm font-bold">{fmt(totals.total_sales)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="w-3 h-3" /> Tunai</p>
            <p className="text-sm font-bold">{fmt(totals.cash_sales)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> QRIS</p>
            <p className="text-sm font-bold">{fmt(totals.qris_sales)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownUp className="w-3 h-3" /> Setoran</p>
            <p className="text-sm font-bold">{fmt(totals.cash_deposit)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-600 text-white">
                  <th className="p-2 text-left whitespace-nowrap">Tanggal</th>
                  <th className="p-2 text-right whitespace-nowrap">Total Sales</th>
                  <th className="p-2 text-right whitespace-nowrap">Tunai</th>
                  <th className="p-2 text-right whitespace-nowrap">QRIS</th>
                  <th className="p-2 text-right whitespace-nowrap">Transfer</th>
                  <th className="p-2 text-right whitespace-nowrap">Beban Op.</th>
                  <th className="p-2 text-right whitespace-nowrap">Setoran</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Memuat...</td></tr>
                ) : deposits.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Tidak ada data</td></tr>
                ) : (
                  <>
                    {deposits.map(row => (
                      <tr key={row.date} className="border-b border-border">
                        <td className="p-2 whitespace-nowrap">{fmtDate(row.date)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{fmt(row.total_sales)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{fmt(row.cash_sales)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{fmt(row.qris_sales)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{fmt(row.transfer_sales)}</td>
                        <td className="p-2 text-right whitespace-nowrap text-red-600">{fmt(row.operational_expenses)}</td>
                        <td className="p-2 text-right whitespace-nowrap font-semibold">{fmt(row.cash_deposit)}</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-muted/50 font-bold border-t-2 border-border">
                      <td className="p-2">Total</td>
                      <td className="p-2 text-right">{fmt(totals.total_sales)}</td>
                      <td className="p-2 text-right">{fmt(totals.cash_sales)}</td>
                      <td className="p-2 text-right">{fmt(totals.qris_sales)}</td>
                      <td className="p-2 text-right">{fmt(totals.transfer_sales)}</td>
                      <td className="p-2 text-right text-red-600">{fmt(totals.operational_expenses)}</td>
                      <td className="p-2 text-right">{fmt(totals.cash_deposit)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileCashDeposit;
