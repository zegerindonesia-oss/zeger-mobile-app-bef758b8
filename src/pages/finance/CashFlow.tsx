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
import { 
  calculateRevenue, 
  calculateRawMaterialCost, 
  calculateOperationalExpenses,
  type RevenueBreakdown,
  type ExpenseBreakdown
} from "@/lib/financial-utils";

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

interface Rider {
  id: string;
  full_name: string;
}

export default function CashFlow() {
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState<RevenueBreakdown>({ cash: 0, qris: 0, transfer: 0, mdr: 0 });
  const [rawMaterialCost, setRawMaterialCost] = useState(0);
  const [expenses, setExpenses] = useState<ExpenseBreakdown>({
    rawMaterial: 0,
    operationalDaily: 0,
    salary: 0,
    rent: 0,
    household: 0,
    environment: 0,
    other: 0,
    marketing: 0,
    administration: 0,
    depreciation: 0,
    interest: 0,
    tax: 0
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
      // Use utility functions for consistent calculations
      const [revenueData, rawMaterialData, expenseData] = await Promise.all([
        calculateRevenue(startDate, endDate, selectedRider),
        calculateRawMaterialCost(startDate, endDate, selectedRider),
        calculateOperationalExpenses(startDate, endDate, selectedRider)
      ]);

      setRevenue(revenueData);
      setRawMaterialCost(rawMaterialData);
      setExpenses(expenseData);
    } catch (error) {
      console.error("Error loading cash flow data:", error);
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
                <div className="space-y-4 pl-4">
                  {/* Revenue Section */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>Penerimaan dari Penjualan</span>
                      <span>{currency.format(revenue.cash + revenue.qris + revenue.transfer)}</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Cash</span>
                      <span>{currency.format(revenue.cash)}</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- QRIS</span>
                      <span>{currency.format(revenue.qris)}</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Transfer</span>
                      <span>{currency.format(revenue.transfer)}</span>
                    </div>
                  </div>

                  {/* Cost of Goods Sold */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>Pembayaran Beban Pokok Penjualan</span>
                      <span>({currency.format(revenue.mdr)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- MDR</span>
                      <span>({currency.format(revenue.mdr)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Diskon</span>
                      <span>{currency.format(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Commission fee</span>
                      <span>{currency.format(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm pl-2 font-medium border-t pt-1">
                      <span>Total</span>
                      <span>{currency.format(revenue.mdr)}</span>
                    </div>
                  </div>

                  {/* HPP/COGS */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>Pembayaran Beban HPP/COGS</span>
                      <span>({currency.format(rawMaterialCost + expenses.rawMaterial)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Bahan Baku</span>
                      <span>({currency.format(rawMaterialCost + expenses.rawMaterial)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Pengiriman</span>
                      <span>{currency.format(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Waste</span>
                      <span>{currency.format(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm pl-2 font-medium border-t pt-1">
                      <span>Total</span>
                      <span>{currency.format(rawMaterialCost + expenses.rawMaterial)}</span>
                    </div>
                  </div>

                  {/* Operational Expenses */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>Pembayaran Beban Operasional</span>
                      <span>({currency.format(expenses.operationalDaily + expenses.salary + expenses.rent + expenses.household + expenses.environment + expenses.other)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Operasional Harian</span>
                      <span>({currency.format(expenses.operationalDaily)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Gaji Karyawan</span>
                      <span>({currency.format(expenses.salary)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Sewa</span>
                      <span>({currency.format(expenses.rent)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Rumah Tangga</span>
                      <span>({currency.format(expenses.household)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Lingkungan</span>
                      <span>({currency.format(expenses.environment)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Lainnya</span>
                      <span>({currency.format(expenses.other)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-2 font-medium border-t pt-1">
                      <span>Total</span>
                      <span>{currency.format(expenses.operationalDaily + expenses.salary + expenses.rent + expenses.household + expenses.environment + expenses.other)}</span>
                    </div>
                  </div>

                  {/* Non-Operational Expenses */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>Pembayaran Beban Non Operasional</span>
                      <span>({currency.format(expenses.marketing + expenses.administration)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Marketing</span>
                      <span>({currency.format(expenses.marketing)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Administrasi</span>
                      <span>({currency.format(expenses.administration)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-2 font-medium border-t pt-1">
                      <span>Total</span>
                      <span>{currency.format(expenses.marketing + expenses.administration)}</span>
                    </div>
                  </div>

                  {/* Other Expenses */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span>Pembayaran Beban Lainnya</span>
                      <span>({currency.format(expenses.depreciation + expenses.interest + expenses.tax)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Depresiasi/Amortisasi</span>
                      <span>({currency.format(expenses.depreciation)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Bunga</span>
                      <span>({currency.format(expenses.interest)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-4">
                      <span>- Beban Pajak</span>
                      <span>({currency.format(expenses.tax)})</span>
                    </div>
                    <div className="flex justify-between text-sm pl-2 font-medium border-t pt-1">
                      <span>Total</span>
                      <span>{currency.format(expenses.depreciation + expenses.interest + expenses.tax)}</span>
                    </div>
                  </div>

                  {/* Net Operating Cash Flow */}
                  <div className="flex justify-between border-t pt-2 font-semibold text-lg">
                    <span>Kas Bersih dari Aktivitas Operasi</span>
                    <span className={
                      (revenue.cash + revenue.qris + revenue.transfer - revenue.mdr - rawMaterialCost - expenses.rawMaterial - 
                       expenses.operationalDaily - expenses.salary - expenses.rent - expenses.household - expenses.environment - 
                       expenses.other - expenses.marketing - expenses.administration - expenses.depreciation - expenses.interest - expenses.tax) >= 0 
                      ? "text-green-600" : "text-red-600"
                    }>
                      {currency.format(
                        revenue.cash + revenue.qris + revenue.transfer - revenue.mdr - rawMaterialCost - expenses.rawMaterial - 
                        expenses.operationalDaily - expenses.salary - expenses.rent - expenses.household - expenses.environment - 
                        expenses.other - expenses.marketing - expenses.administration - expenses.depreciation - expenses.interest - expenses.tax
                      )}
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
                  <span className={
                    (revenue.cash + revenue.qris + revenue.transfer - revenue.mdr - rawMaterialCost - expenses.rawMaterial - 
                     expenses.operationalDaily - expenses.salary - expenses.rent - expenses.household - expenses.environment - 
                     expenses.other - expenses.marketing - expenses.administration - expenses.depreciation - expenses.interest - expenses.tax) >= 0 
                    ? "text-green-600" : "text-red-600"
                  }>
                    {currency.format(
                      revenue.cash + revenue.qris + revenue.transfer - revenue.mdr - rawMaterialCost - expenses.rawMaterial - 
                      expenses.operationalDaily - expenses.salary - expenses.rent - expenses.household - expenses.environment - 
                      expenses.other - expenses.marketing - expenses.administration - expenses.depreciation - expenses.interest - expenses.tax
                    )}
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
