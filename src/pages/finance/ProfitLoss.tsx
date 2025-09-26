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
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRiderFilter } from "@/hooks/useRiderFilter";
import { calculateSalesData, calculateRawMaterialCost, calculateOperationalExpenses, calculateRevenue, calculateNetProfit, type RevenueBreakdown, type ExpenseBreakdown } from "@/lib/financial-utils";
import { getTodayJakarta } from "@/lib/date";

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

interface Rider {
  id: string;
  full_name: string;
}

export default function ProfitLoss() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { assignedRiderId, assignedRiderName, shouldAutoFilter } = useRiderFilter();
  
  const [revenue, setRevenue] = useState<RevenueBreakdown>({
    cash: 0,
    qris: 0,
    transfer: 0,
    mdr: 0
  });
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
  const [selectedRider, setSelectedRider] = useState<string>(() => {
    if (shouldAutoFilter && assignedRiderId) {
      return assignedRiderId;
    }
    return "all";
  });
  
  // Use Indonesian timezone for dates
  const getJakartaDate = () => {
    const jakartaTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    return jakartaTime;
  };
  
  const [startDate, setStartDate] = useState<Date>(new Date(getJakartaDate().getFullYear(), getJakartaDate().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(getJakartaDate());

  const fetchRiders = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'rider')
      .eq('is_active', true);
    
    setRiders(data || []);
  };

  const [rawMaterialCost, setRawMaterialCost] = useState(0);

  const loadData = async () => {
    setLoading(true);
    
    try {
      console.log("🔄 Loading Profit/Loss data using centralized calculations...");
      console.log("📊 Date range:", { startDate, endDate, selectedRider });

      // Use centralized financial calculation functions for consistency
      const [revenueData, expensesData, rawMaterial] = await Promise.all([
        calculateRevenue(
          startDate,
          endDate,
          selectedRider === "all" ? undefined : selectedRider
        ),
        calculateOperationalExpenses(
          startDate,
          endDate,
          selectedRider === "all" ? undefined : selectedRider
        ),
        calculateRawMaterialCost(
          startDate,
          endDate,
          selectedRider === "all" ? undefined : selectedRider
        )
      ]);

      console.log("✅ Centralized calculations completed:", {
        revenue: revenueData.cash + revenueData.qris + revenueData.transfer,
        rawMaterial,
        expenses: Object.values(expensesData).reduce((sum, val) => sum + val, 0)
      });

      setRevenue(revenueData);
      setExpenses(expensesData);
      setRawMaterialCost(rawMaterial);

    } catch (error) {
      console.error("❌ Error loading profit/loss data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile && userProfile.role !== 'bh_report') {
      fetchRiders();
    }
  }, [userProfile]);

  useEffect(() => {
    // Auto-set selected rider for bh_report users
    if (shouldAutoFilter && assignedRiderId && selectedRider !== assignedRiderId) {
      setSelectedRider(assignedRiderId);
    }
  }, [shouldAutoFilter, assignedRiderId, selectedRider]);

  useEffect(() => {
    loadData();
  }, [selectedRider, startDate, endDate]);

  const totalRevenue = revenue.cash + revenue.qris + revenue.transfer;
  const totalExpenses = rawMaterialCost + Object.values(expenses).reduce((sum, val) => sum + val, 0);
  const profit = calculateNetProfit(revenue, rawMaterialCost, expenses);

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
          <div className="space-y-4">
            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = getJakartaDate();
                  setStartDate(today);
                  setEndDate(today);
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = getJakartaDate();
                  const weekStart = new Date(today);
                  weekStart.setDate(today.getDate() - today.getDay());
                  setStartDate(weekStart);
                  setEndDate(today);
                }}
              >
                Weekly
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = getJakartaDate();
                  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                  setStartDate(monthStart);
                  setEndDate(today);
                }}
              >
                Monthly
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* User selector - conditional for bh_report users */}
              {userProfile?.role !== 'bh_report' ? (
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
              ) : (
                <div>
                  <Label>Assigned Rider</Label>
                  <div className="px-3 py-2 bg-muted rounded-md text-sm border">
                    {assignedRiderName || 'Loading...'}
                  </div>
                </div>
              )}
              
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

            <div className="flex justify-end">
              <Button onClick={loadData} className="px-6">
                Apply Filter
              </Button>
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
                      <span>- QRIS</span>
                      <span>{currency.format(revenue.qris)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>- Transfer Bank</span>
                      <span>{currency.format(revenue.transfer)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Pendapatan</span>
                    <span>{currency.format(totalRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* BEBAN POKOK PENJUALAN */}
              <div>
                <h3 className="text-lg font-semibold mb-3">BEBAN POKOK PENJUALAN</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between">
                    <span>MDR (QRIS 0.7%)</span>
                    <span className="font-medium">({currency.format(revenue.mdr)})</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Beban Pokok Penjualan</span>
                    <span>({currency.format(revenue.mdr)})</span>
                  </div>
                </div>
              </div>

              {/* LABA KOTOR */}
              <div className="bg-muted/50 p-3 rounded">
                <div className="flex justify-between font-semibold">
                  <span>LABA KOTOR</span>
                  <span className="text-green-600">{currency.format(totalRevenue - revenue.mdr)}</span>
                </div>
              </div>

              {/* BEBAN OPERASIONAL */}
              <div>
                <h3 className="text-lg font-semibold mb-3">BEBAN OPERASIONAL</h3>
                <div className="space-y-2 pl-4">
                   <div className="flex justify-between">
                     <span>Beban Bahan Baku</span>
                     <span className="font-medium">({currency.format(rawMaterialCost)})</span>
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
                    <span>Beban Sewa</span>
                    <span className="font-medium">({currency.format(expenses.rent)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Beban Rumah Tangga</span>
                    <span className="font-medium">({currency.format(expenses.household)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Beban Lainnya</span>
                    <span className="font-medium">({currency.format(expenses.other)})</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total Beban Operasional</span>
                    <span>({currency.format(totalExpenses)})</span>
                  </div>
                </div>

                {/* BEBAN NON OPERASIONAL */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 mt-6">BEBAN NON OPERASIONAL</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span>Beban Marketing</span>
                      <span className="font-medium">({currency.format(0)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Beban Administrasi</span>
                      <span className="font-medium">({currency.format(0)})</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>Total Beban Non Operasional</span>
                      <span>({currency.format(0)})</span>
                    </div>
                  </div>
                </div>

                {/* BEBAN LAINNYA */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 mt-6">BEBAN LAINNYA</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between">
                      <span>Depresiasi/Amortisasi</span>
                      <span className="font-medium">({currency.format(0)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bunga</span>
                      <span className="font-medium">({currency.format(0)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pajak</span>
                      <span className="font-medium">({currency.format(0)})</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-semibold">
                      <span>Total Beban Lainnya</span>
                      <span>({currency.format(0)})</span>
                    </div>
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
