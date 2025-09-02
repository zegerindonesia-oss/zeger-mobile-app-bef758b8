import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function CashFlow() {
  const [loading, setLoading] = useState(true);
  const [cashIn, setCashIn] = useState(0);
  const [cashOut, setCashOut] = useState(0);
  const [operatingCashFlow, setOperatingCashFlow] = useState(0);
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
    
    // Use Jakarta day boundaries and compute from transactions + rider expenses
    const toJkt = (d: Date) => new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).toISOString().split('T')[0];
    const s = toJkt(startDate);
    const e = toJkt(endDate);

    // Cash in from sales transactions
    let salesQuery = supabase
      .from('transactions')
      .select('final_amount, payment_method, rider_id, status, transaction_date')
      .eq('status', 'completed')
      .gte('transaction_date', `${s}T00:00:00+07:00`)
      .lte('transaction_date', `${e}T23:59:59+07:00`);

    if (selectedRider !== "all") {
      salesQuery = salesQuery.eq('rider_id', selectedRider);
    }

    const { data: sales } = await salesQuery;
    const inVal = (sales || []).reduce((sum: number, t: any) => sum + Number(t.final_amount || 0), 0);

    // Cash out from rider daily expenses (all types)
    let riderExpQuery = supabase
      .from('daily_operational_expenses')
      .select('amount, rider_id, expense_date')
      .gte('expense_date', s)
      .lte('expense_date', e);

    if (selectedRider !== "all") {
      riderExpQuery = riderExpQuery.eq('rider_id', selectedRider);
    }

    const { data: riderExp } = await riderExpQuery;
    const outVal = (riderExp || []).reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

    setCashIn(inVal);
    setCashOut(outVal);
    setOperatingCashFlow(inVal - outVal);
    setLoading(false);
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedRider, startDate, endDate]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Laporan Arus Kas</h1>
        <p className="text-muted-foreground">Laporan pergerakan kas masuk dan keluar</p>
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

      {/* Cash Flow Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Laporan Arus Kas</CardTitle>
          <p className="text-sm text-muted-foreground">Periode {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Operating Activities */}
              <div>
                <h3 className="text-lg font-semibold mb-3">ARUS KAS DARI AKTIVITAS OPERASI</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between">
                    <span>Penerimaan dari Penjualan</span>
                    <span className="font-medium">{currency.format(cashIn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pembayaran untuk Beban Operasi</span>
                    <span className="font-medium">({currency.format(cashOut)})</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Kas Bersih dari Aktivitas Operasi</span>
                    <span className={operatingCashFlow >= 0 ? "text-green-600" : "text-red-600"}>
                      {currency.format(operatingCashFlow)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Investing Activities */}
              <div>
                <h3 className="text-lg font-semibold mb-3">ARUS KAS DARI AKTIVITAS INVESTASI</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between">
                    <span>-</span>
                    <span className="font-medium">{currency.format(0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Kas Bersih dari Aktivitas Investasi</span>
                    <span>{currency.format(0)}</span>
                  </div>
                </div>
              </div>

              {/* Financing Activities */}
              <div>
                <h3 className="text-lg font-semibold mb-3">ARUS KAS DARI AKTIVITAS PENDANAAN</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between">
                    <span>-</span>
                    <span className="font-medium">{currency.format(0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Kas Bersih dari Aktivitas Pendanaan</span>
                    <span>{currency.format(0)}</span>
                  </div>
                </div>
              </div>

              {/* Net Change */}
              <div className="border-t-2 border-double pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>KENAIKAN (PENURUNAN) BERSIH KAS</span>
                  <span className={operatingCashFlow >= 0 ? "text-green-600" : "text-red-600"}>
                    {currency.format(operatingCashFlow)}
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
