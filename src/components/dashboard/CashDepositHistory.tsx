import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

interface Rider {
  id: string;
  full_name: string;
}

interface CashDepositData {
  rider_id: string;
  rider_name: string;
  date: string;
  total_sales: number;
  cash_sales: number;
  qris_sales: number;
  transfer_sales: number;
  operational_expenses: number;
  cash_deposit: number;
  verified_total_sales: boolean;
  verified_cash_sales: boolean;
  verified_qris_sales: boolean;
  verified_transfer_sales: boolean;
  verified_operational_expenses: boolean;
  verified_cash_deposit: boolean;
  notes: string;
}

export const CashDepositHistory = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedRider, setSelectedRider] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [cashDeposits, setCashDeposits] = useState<CashDepositData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRiders();
  }, []);

  useEffect(() => {
    if (riders.length > 0) {
      fetchCashDeposits();
    }
  }, [selectedRider, dateFilter, riders]);

  const fetchRiders = async () => {
    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role, branch_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      let query = supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['rider', 'sb_rider', 'bh_rider'])
        .eq('is_active', true)
        .order('full_name');

      if (userProfile?.role === 'branch_manager' && userProfile.branch_id) {
        query = query.eq('branch_id', userProfile.branch_id);
      } else if (userProfile?.role === 'sb_branch_manager' && userProfile.branch_id) {
        query = query.eq('branch_id', userProfile.branch_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error('Error fetching riders:', error);
      toast.error('Gagal memuat data rider');
    }
  };

  const formatYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getDateRange = () => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date = new Date(today.setHours(23, 59, 59, 999));

    switch (dateFilter) {
      case 'yesterday':
        startDate = new Date(today.setDate(today.getDate() - 1));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today.setHours(23, 59, 59, 999));
        break;
      case 'this_week':
        const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
        startDate = new Date(weekStart.setHours(0, 0, 0, 0));
        break;
      case 'this_month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          return null;
        }
        break;
      default: // today
        startDate = new Date(today.setHours(0, 0, 0, 0));
        break;
    }

    return { startDate, endDate };
  };

  const fetchCashDeposits = async () => {
    const dateRange = getDateRange();
    if (!dateRange) return;

    setLoading(true);
    try {
      const { startDate, endDate } = dateRange;
      const startYMD = formatYMD(startDate);
      const endYMD = formatYMD(endDate);

      // Fetch transactions (exclude voided transactions)
      let transactionQuery = supabase
        .from('transactions')
        .select(`
          id,
          transaction_date,
          final_amount,
          payment_method,
          rider_id,
          profiles!transactions_rider_id_fkey(full_name)
        `)
        .eq('status', 'completed')
        .eq('is_voided', false)
        .gte('transaction_date', `${startYMD}T00:00:00+07:00`)
        .lte('transaction_date', `${endYMD}T23:59:59+07:00`);

      if (selectedRider !== 'all') {
        transactionQuery = transactionQuery.eq('rider_id', selectedRider);
      }

      const { data: transactions, error: transError } = await transactionQuery;
      if (transError) throw transError;

      // Fetch operational expenses
      let expenseQuery = supabase
        .from('daily_operational_expenses')
        .select('rider_id, expense_date, amount')
        .gte('expense_date', startYMD)
        .lte('expense_date', endYMD);

      if (selectedRider !== 'all') {
        expenseQuery = expenseQuery.eq('rider_id', selectedRider);
      }

      const { data: expenses, error: expError } = await expenseQuery;
      if (expError) throw expError;

      // Process data by rider and date
      const depositMap = new Map<string, CashDepositData>();

      transactions?.forEach(tx => {
        const date = new Date(tx.transaction_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const key = `${tx.rider_id}_${date}`;
        
        if (!depositMap.has(key)) {
          depositMap.set(key, {
            rider_id: tx.rider_id,
            rider_name: tx.profiles?.full_name || 'Unknown',
            date: date,
            total_sales: 0,
            cash_sales: 0,
            qris_sales: 0,
            transfer_sales: 0,
            operational_expenses: 0,
            cash_deposit: 0,
            verified_total_sales: false,
            verified_cash_sales: false,
            verified_qris_sales: false,
            verified_transfer_sales: false,
            verified_operational_expenses: false,
            verified_cash_deposit: false,
            notes: ''
          });
        }

        const deposit = depositMap.get(key)!;
        deposit.total_sales += tx.final_amount;

        if (tx.payment_method === 'cash') {
          deposit.cash_sales += tx.final_amount;
        } else if (tx.payment_method === 'qris') {
          deposit.qris_sales += tx.final_amount;
        } else if (tx.payment_method === 'bank_transfer') {
          deposit.transfer_sales += tx.final_amount;
        }
      });

      expenses?.forEach(exp => {
        const key = `${exp.rider_id}_${exp.expense_date}`;
        const deposit = depositMap.get(key);
        if (deposit) {
          deposit.operational_expenses += exp.amount;
        }
      });

      // Calculate cash deposit
      depositMap.forEach(deposit => {
        deposit.cash_deposit = deposit.cash_sales - deposit.operational_expenses;
      });

      // Fetch verification data
      const depositArray = Array.from(depositMap.values());
      if (depositArray.length > 0) {
        const { data: verifications } = await supabase
          .from('cash_deposit_verifications')
          .select('*')
          .in('rider_id', depositArray.map(d => d.rider_id))
          .gte('deposit_date', startYMD)
          .lte('deposit_date', endYMD);

        // Merge verification data
        verifications?.forEach(v => {
          const key = `${v.rider_id}_${v.deposit_date}`;
          const deposit = depositMap.get(key);
          if (deposit) {
            deposit.verified_total_sales = v.verified_total_sales || false;
            deposit.verified_cash_sales = v.verified_cash_sales || false;
            deposit.verified_qris_sales = v.verified_qris_sales || false;
            deposit.verified_transfer_sales = v.verified_transfer_sales || false;
            deposit.verified_operational_expenses = v.verified_operational_expenses || false;
            deposit.verified_cash_deposit = v.verified_cash_deposit || false;
            deposit.notes = v.notes || '';
          }
        });
      }

      setCashDeposits(Array.from(depositMap.values()).sort((a, b) => 
        b.date.localeCompare(a.date) || a.rider_name.localeCompare(b.rider_name)
      ));
    } catch (error) {
      console.error('Error fetching cash deposits:', error);
      toast.error('Gagal memuat data setoran tunai');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const handleVerificationChange = async (
    item: CashDepositData,
    field: keyof Pick<CashDepositData, 'verified_total_sales' | 'verified_cash_sales' | 'verified_qris_sales' | 'verified_transfer_sales' | 'verified_operational_expenses' | 'verified_cash_deposit'>,
    checked: boolean
  ) => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.user?.id)
        .single();

      const { error } = await supabase
        .from('cash_deposit_verifications')
        .upsert({
          rider_id: item.rider_id,
          deposit_date: item.date,
          [field]: checked,
          verified_by: profile?.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'rider_id,deposit_date'
        });

      if (error) throw error;

      // Update local state
      setCashDeposits(prev => prev.map(d => 
        d.rider_id === item.rider_id && d.date === item.date 
          ? { ...d, [field]: checked }
          : d
      ));

      toast.success('Status verifikasi diperbarui');
    } catch (error) {
      console.error('Error updating verification:', error);
      toast.error('Gagal memperbarui verifikasi');
    }
  };

  const handleNotesChange = async (item: CashDepositData, notes: string) => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.user?.id)
        .single();

      const { error } = await supabase
        .from('cash_deposit_verifications')
        .upsert({
          rider_id: item.rider_id,
          deposit_date: item.date,
          notes: notes,
          verified_by: profile?.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'rider_id,deposit_date'
        });

      if (error) throw error;

      // Update local state
      setCashDeposits(prev => prev.map(d => 
        d.rider_id === item.rider_id && d.date === item.date 
          ? { ...d, notes }
          : d
      ));
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Gagal menyimpan keterangan');
    }
  };

  // Calculate resume data (aggregated by rider)
  const resumeData = cashDeposits.reduce((acc, curr) => {
    const existing = acc.find(item => item.rider_id === curr.rider_id);
    if (existing) {
      existing.total_sales += curr.total_sales;
      existing.cash_sales += curr.cash_sales;
      existing.qris_sales += curr.qris_sales;
      existing.transfer_sales += curr.transfer_sales;
      existing.operational_expenses += curr.operational_expenses;
      existing.cash_deposit += curr.cash_deposit;
    } else {
      acc.push({ ...curr });
    }
    return acc;
  }, [] as CashDepositData[]);

  // Calculate totals and averages
  const totals = cashDeposits.reduce((acc, curr) => ({
    total_sales: acc.total_sales + curr.total_sales,
    cash_sales: acc.cash_sales + curr.cash_sales,
    qris_sales: acc.qris_sales + curr.qris_sales,
    transfer_sales: acc.transfer_sales + curr.transfer_sales,
    operational_expenses: acc.operational_expenses + curr.operational_expenses,
    cash_deposit: acc.cash_deposit + curr.cash_deposit
  }), {
    total_sales: 0,
    cash_sales: 0,
    qris_sales: 0,
    transfer_sales: 0,
    operational_expenses: 0,
    cash_deposit: 0
  });

  const averages = {
    total_sales: cashDeposits.length > 0 ? totals.total_sales / cashDeposits.length : 0,
    cash_sales: cashDeposits.length > 0 ? totals.cash_sales / cashDeposits.length : 0,
    qris_sales: cashDeposits.length > 0 ? totals.qris_sales / cashDeposits.length : 0,
    transfer_sales: cashDeposits.length > 0 ? totals.transfer_sales / cashDeposits.length : 0,
    operational_expenses: cashDeposits.length > 0 ? totals.operational_expenses / cashDeposits.length : 0,
    cash_deposit: cashDeposits.length > 0 ? totals.cash_deposit / cashDeposits.length : 0
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Riwayat Setoran Tunai</h2>
        <p className="text-sm text-muted-foreground">Data setoran tunai harian dari rider</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Rider</Label>
              <Select value={selectedRider} onValueChange={setSelectedRider}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Rider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Rider</SelectItem>
                  {riders.map(rider => (
                    <SelectItem key={rider.id} value={rider.id}>
                      {rider.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Periode</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yesterday">Kemarin</SelectItem>
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="this_week">Minggu Ini</SelectItem>
                  <SelectItem value="this_month">Bulan Ini</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <div>
                  <Label>Dari Tanggal</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Sampai Tanggal</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex items-end">
              <Button onClick={fetchCashDeposits} disabled={loading}>
                <Calendar className="w-4 h-4 mr-2" />
                {loading ? 'Loading...' : 'Apply Filter'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resume Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resume Setoran Tunai</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Nama Rider</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Penjualan Tunai</TableHead>
                  <TableHead className="text-right">QRIS</TableHead>
                  <TableHead className="text-right">Transfer Bank</TableHead>
                  <TableHead className="text-right">Beban Operasional</TableHead>
                  <TableHead className="text-right">Total Setoran Tunai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumeData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                ) : (
                  resumeData.map((item, idx) => (
                    <TableRow key={item.rider_id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium">{item.rider_name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cash_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.qris_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.transfer_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.operational_expenses)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.cash_deposit)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Setoran Tunai</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nama Rider</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Penjualan Tunai</TableHead>
                  <TableHead className="text-right">QRIS</TableHead>
                  <TableHead className="text-right">Transfer Bank</TableHead>
                  <TableHead className="text-right">Beban Operasional</TableHead>
                  <TableHead className="text-right">Total Setoran Tunai</TableHead>
                  <TableHead className="w-32">Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashDeposits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {cashDeposits.map((item, idx) => (
                      <TableRow key={`${item.rider_id}_${item.date}`}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        <TableCell className="font-medium">{item.rider_name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Checkbox
                              checked={item.verified_total_sales}
                              onCheckedChange={(checked) => handleVerificationChange(item, 'verified_total_sales', checked as boolean)}
                              className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                            />
                            <span>{formatCurrency(item.total_sales)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Checkbox
                              checked={item.verified_cash_sales}
                              onCheckedChange={(checked) => handleVerificationChange(item, 'verified_cash_sales', checked as boolean)}
                              className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                            />
                            <span>{formatCurrency(item.cash_sales)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Checkbox
                              checked={item.verified_qris_sales}
                              onCheckedChange={(checked) => handleVerificationChange(item, 'verified_qris_sales', checked as boolean)}
                              className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                            />
                            <span>{formatCurrency(item.qris_sales)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Checkbox
                              checked={item.verified_transfer_sales}
                              onCheckedChange={(checked) => handleVerificationChange(item, 'verified_transfer_sales', checked as boolean)}
                              className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                            />
                            <span>{formatCurrency(item.transfer_sales)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Checkbox
                              checked={item.verified_operational_expenses}
                              onCheckedChange={(checked) => handleVerificationChange(item, 'verified_operational_expenses', checked as boolean)}
                              className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                            />
                            <span>{formatCurrency(item.operational_expenses)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Checkbox
                              checked={item.verified_cash_deposit}
                              onCheckedChange={(checked) => handleVerificationChange(item, 'verified_cash_deposit', checked as boolean)}
                              className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                            />
                            <span className="font-semibold">{formatCurrency(item.cash_deposit)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Catatan..."
                            value={item.notes}
                            onChange={(e) => handleNotesChange(item, e.target.value)}
                            onBlur={(e) => handleNotesChange(item, e.target.value)}
                            className="w-32 h-8 text-xs"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.total_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.cash_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.qris_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.transfer_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.operational_expenses)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totals.cash_deposit)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {/* Average Row */}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell colSpan={3}>RATA-RATA</TableCell>
                      <TableCell className="text-right">{formatCurrency(averages.total_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(averages.cash_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(averages.qris_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(averages.transfer_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(averages.operational_expenses)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(averages.cash_deposit)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
