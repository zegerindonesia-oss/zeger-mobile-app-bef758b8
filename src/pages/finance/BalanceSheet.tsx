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

export default function BalanceSheet() {
  const [assets, setAssets] = useState(0);
  const [liabilities, setLiabilities] = useState(0);
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
    // Connect to actual sales transactions (Jakarta date range)
    const toJkt = (d: Date) => new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).toISOString().split('T')[0];
    const s = toJkt(startDate);
    const e = toJkt(endDate);

    let tx = supabase
      .from('transactions')
      .select('final_amount, payment_method, rider_id, status, transaction_date')
      .eq('status', 'completed')
      .gte('transaction_date', `${s}T00:00:00+07:00`)
      .lte('transaction_date', `${e}T23:59:59+07:00`);

    if (selectedRider !== "all") {
      tx = tx.eq('rider_id', selectedRider);
    }

    const { data: transactions } = await tx;
    // Treat cash sales as current assets (cash & equivalents)
    const assetsVal = (transactions || [])
      .filter((t: any) => t.payment_method === 'cash')
      .reduce((sum: number, t: any) => sum + Number(t.final_amount || 0), 0);

    setAssets(assetsVal);
    setLiabilities(0); // Placeholder until liabilities mapping is defined
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedRider, startDate, endDate]);

  const equity = assets - liabilities;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Neraca</h1>
        <p className="text-muted-foreground">Laporan posisi keuangan - aset, kewajiban, dan ekuitas</p>
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

      {/* Balance Sheet Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Laporan Neraca</CardTitle>
          <p className="text-sm text-muted-foreground">Per {format(endDate, "dd MMMM yyyy")}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* ASET */}
            <div>
              <h3 className="text-lg font-semibold mb-3">ASET</h3>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between">
                  <span>Kas dan Setara Kas</span>
                  <span className="font-medium">{currency.format(assets)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total Aset</span>
                  <span>{currency.format(assets)}</span>
                </div>
              </div>
            </div>

            {/* KEWAJIBAN */}
            <div>
              <h3 className="text-lg font-semibold mb-3">KEWAJIBAN</h3>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between">
                  <span>Kewajiban Lancar</span>
                  <span className="font-medium">{currency.format(liabilities)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total Kewajiban</span>
                  <span>{currency.format(liabilities)}</span>
                </div>
              </div>
            </div>

            {/* EKUITAS */}
            <div>
              <h3 className="text-lg font-semibold mb-3">EKUITAS</h3>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between">
                  <span>Modal Pemilik</span>
                  <span className="font-medium">{currency.format(equity)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Total Ekuitas</span>
                  <span>{currency.format(equity)}</span>
                </div>
              </div>
            </div>

            {/* TOTAL */}
            <div className="border-t-2 border-double pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>TOTAL KEWAJIBAN DAN EKUITAS</span>
                <span>{currency.format(liabilities + equity)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
