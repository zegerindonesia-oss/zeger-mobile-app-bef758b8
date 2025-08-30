import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

interface Rider {
  id: string;
  full_name: string;
}

export default function ProfitLoss() {
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState({
    cash: 0,
    nonCash: 0,
    total: 0
  });
  const [expenses, setExpenses] = useState({
    rawMaterial: 0,
    operationalDaily: 0,
    salary: 0,
    other: 0,
    mdr: 0,
    total: 0
  });
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedRider, setSelectedRider] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const fetchRiders = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'rider')
      .eq('is_active', true);
    
    setRiders(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    
    try {
      // Load transactions for revenue calculation
      let transQuery = supabase
        .from('transactions')
        .select('final_amount, payment_method')
        .eq('status', 'completed')
        .gte('transaction_date', startDate.toISOString())
        .lte('transaction_date', endDate.toISOString());

      if (selectedRider !== "all") {
        transQuery = transQuery.eq('rider_id', selectedRider);
      }

      const { data: transactions } = await transQuery;

      // Calculate revenue breakdown
      let cashRevenue = 0;
      let nonCashRevenue = 0;
      let mdrAmount = 0;

      (transactions || []).forEach((trans: any) => {
        const amount = Number(trans.final_amount || 0);
        if (trans.payment_method === 'cash') {
          cashRevenue += amount;
        } else if (trans.payment_method === 'qris' || trans.payment_method === 'transfer') {
          nonCashRevenue += amount;
          if (trans.payment_method === 'qris') {
            mdrAmount += amount * 0.007; // 0.7% MDR
          }
        }
      });

      // Load expenses
      let rawMaterialCost = 0;
      let operationalDaily = 0;
      let salaryCost = 0;
      let otherCost = 0;

      // Production costs (raw materials)
      const { data: prodItems } = await supabase
        .from('production_items')
        .select('quantity, cost_per_unit, production_batches!inner(produced_at)')
        .gte('production_batches.produced_at', startDate.toISOString())
        .lte('production_batches.produced_at', endDate.toISOString());

      rawMaterialCost = (prodItems || []).reduce((sum: number, item: any) => 
        sum + (item.quantity * item.cost_per_unit), 0);

      // Daily operational expenses from riders
      let dailyExpQuery = supabase
        .from('daily_operational_expenses')
        .select('amount')
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .lte('expense_date', endDate.toISOString().split('T')[0]);

      if (selectedRider !== "all") {
        dailyExpQuery = dailyExpQuery.eq('rider_id', selectedRider);
      }

      const { data: dailyExp } = await dailyExpQuery;
      operationalDaily = (dailyExp || []).reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);

      // Operational expenses (salary, other)
      let opExpQuery = supabase
        .from('operational_expenses')
        .select('amount, expense_category')
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .lte('expense_date', endDate.toISOString().split('T')[0]);

      const { data: opExp } = await opExpQuery;
      (opExp || []).forEach((exp: any) => {
        const amount = Number(exp.amount || 0);
        if (exp.expense_category === 'salary') {
          salaryCost += amount;
        } else {
          otherCost += amount;
        }
      });

      setRevenue({
        cash: cashRevenue,
        nonCash: nonCashRevenue,
        total: cashRevenue + nonCashRevenue
      });

      setExpenses({
        rawMaterial: rawMaterialCost,
        operationalDaily,
        salary: salaryCost,
        other: otherCost,
        mdr: mdrAmount,
        total: rawMaterialCost + operationalDaily + salaryCost + otherCost + mdrAmount
      });

    } catch (error) {
      console.error("Error loading profit/loss data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedRider, startDate, endDate]);

  const profit = revenue.total - expenses.total;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Laporan Laba Rugi</h1>
        <p className="text-muted-foreground">Laporan kinerja keuangan - pendapatan, beban, dan laba</p>
      </header>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>User</Label>
              <Select value={selectedRider} onValueChange={setSelectedRider}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua User</SelectItem>
                  {riders.map((rider) => (
                    <SelectItem key={rider.id} value={rider.id}>
                      {rider.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Periode Awal</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Periode Akhir</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit & Loss Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Laporan Laba Rugi</CardTitle>
          <p className="text-sm text-muted-foreground">Periode {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* PENDAPATAN */}
              <div>
                <h3 className="text-lg font-semibold mb-3">PENDAPATAN</h3>
                <div className="space-y-2 pl-4">
                  <div className="text-sm font-medium mb-2">Pendapatan Penjualan:</div>
                  <div className="space-y-1 pl-4">
                    <div className="flex justify-between text-sm">
                      <span>- Tunai</span>
                      <span>{currency.format(revenue.cash)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>- Non Tunai (QRIS + Transfer)</span>
                      <span>{currency.format(revenue.nonCash)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Pendapatan</span>
                    <span>{currency.format(revenue.total)}</span>
                  </div>
                </div>
              </div>

              {/* BEBAN POKOK PENJUALAN */}
              <div>
                <h3 className="text-lg font-semibold mb-3">BEBAN POKOK PENJUALAN</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between">
                    <span>MDR (QRIS 0.7%)</span>
                    <span className="font-medium">({currency.format(expenses.mdr)})</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Beban Pokok Penjualan</span>
                    <span>({currency.format(expenses.mdr)})</span>
                  </div>
                </div>
              </div>

              {/* LABA KOTOR */}
              <div className="bg-muted/50 p-3 rounded">
                <div className="flex justify-between font-semibold">
                  <span>LABA KOTOR</span>
                  <span className="text-green-600">{currency.format(revenue.total - expenses.mdr)}</span>
                </div>
              </div>

              {/* BEBAN OPERASIONAL */}
              <div>
                <h3 className="text-lg font-semibold mb-3">BEBAN OPERASIONAL</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between">
                    <span>Beban Bahan Baku</span>
                    <span className="font-medium">({currency.format(expenses.rawMaterial)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Beban Operasional Harian</span>
                    <span className="font-medium">({currency.format(expenses.operationalDaily)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Beban Gaji</span>
                    <span className="font-medium">({currency.format(expenses.salary)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Beban Lainnya</span>
                    <span className="font-medium">({currency.format(expenses.other)})</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Beban Operasional</span>
                    <span>({currency.format(expenses.total - expenses.mdr)})</span>
                  </div>
                </div>
              </div>

              {/* LABA RUGI */}
              <div className="border-t-2 border-double pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>LABA (RUGI) BERSIH</span>
                  <span className={profit >= 0 ? "text-green-600" : "text-red-600"}>
                    {currency.format(profit)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
