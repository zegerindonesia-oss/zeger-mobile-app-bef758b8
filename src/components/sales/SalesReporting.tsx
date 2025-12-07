import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Camera, 
  DollarSign,
  CreditCard,
  Smartphone,
  Check,
  AlertTriangle,
  Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SalesReportingProps {
  role: 'rider' | 'branch_manager';
  userId: string;
  branchId?: string;
}

interface SalesTransaction {
  id: string;
  transaction_number: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  payment_proof?: string;
  cash_amount?: number;
  non_cash_amount?: number;
}

interface DailyReport {
  id?: string;
  report_date: string;
  total_sales: number;
  cash_collected: number; // cash + transfer for deposit calc
  total_transactions: number;
  photos: any[];
  verified_by?: string;
  verified_at?: string;
  start_location?: string;
  end_location?: string;
  operational_cost?: number;
  cash_deposit_required?: number;
  // Added breakdown fields
  cash_sales?: number;
  qris_sales?: number;
  transfer_sales?: number;
}

export const SalesReporting = ({ role, userId, branchId }: SalesReportingProps) => {
  const [filterPeriod, setFilterPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
const [dailyReport, setDailyReport] = useState<DailyReport>({
  report_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
  total_sales: 0,
  cash_collected: 0,
  total_transactions: 0,
  photos: [],
  operational_cost: 0,
  cash_deposit_required: 0,
  cash_sales: 0,
  qris_sales: 0,
  transfer_sales: 0
});
  const [loading, setLoading] = useState(false);
  const [paymentProofFiles, setPaymentProofFiles] = useState<{[key: string]: File}>({});

  useEffect(() => {
    if (role === 'rider') {
      fetchTodayTransactions();
    } else if (role === 'branch_manager') {
      fetchPendingReports();
    }
  }, []);

  const fetchTodayTransactions = async () => {
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('rider_id', userId)
        .gte('transaction_date', `${today}T00:00:00+07:00`)
        .lt('transaction_date', `${today}T23:59:59+07:00`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);
      calculateDailyReport(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat transaksi");
    }
  };

  const calculateDailyReport = (transactions: SalesTransaction[]) => {
    const cashTransactions = transactions.filter(t => t.payment_method === 'cash');
    const transferTransactions = transactions.filter(t => t.payment_method === 'transfer');
    const qrisTransactions = transactions.filter(t => t.payment_method === 'qris');
    
    const totalSales = transactions.reduce((sum, t) => sum + t.total_amount, 0);
    const cashCollected = cashTransactions.reduce((sum, t) => sum + t.total_amount, 0);
    const transferAmount = transferTransactions.reduce((sum, t) => sum + t.total_amount, 0);
    const qrisAmount = qrisTransactions.reduce((sum, t) => sum + t.total_amount, 0);
    
    // Total collected includes cash and transfer (both need to be deposited)
    const totalCollected = cashCollected + transferAmount;
    
    // Operational cost calculation (example: 10% of total collected)
    const operationalCost = totalCollected * 0.1;
    const cashDepositRequired = totalCollected - operationalCost;

setDailyReport(prev => ({
  ...prev,
  total_sales: totalSales,
  cash_collected: totalCollected, // Now includes cash + transfer
  total_transactions: transactions.length,
  operational_cost: operationalCost,
  cash_deposit_required: cashDepositRequired,
  cash_sales: cashCollected,
  qris_sales: qrisAmount,
  transfer_sales: transferAmount
}));
  };

  const fetchPendingReports = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('branch_id', branchId)
        .is('verified_at', null)
        .order('report_date', { ascending: false });

      if (error) throw error;

      // Handle pending reports for branch manager verification
      console.log('Pending reports:', data);
    } catch (error: any) {
      toast.error("Gagal memuat laporan pending");
    }
  };

  const uploadPaymentProof = async (transactionId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `payment-${transactionId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          notes: JSON.stringify({ payment_proof: fileName })
        })
        .eq('id', transactionId);

      if (updateError) throw updateError;

      toast.success("Bukti pembayaran berhasil diupload!");
      fetchTodayTransactions();
    } catch (error: any) {
      toast.error("Gagal upload bukti: " + error.message);
    }
  };

  const uploadReportPhoto = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `report-${userId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setDailyReport(prev => ({
        ...prev,
        photos: [...prev.photos, fileName]
      }));

      toast.success("Foto laporan berhasil diupload!");
    } catch (error: any) {
      toast.error("Gagal upload foto: " + error.message);
    }
  };

  const submitDailyReport = async () => {
    setLoading(true);
    try {
      const reportData = {
        rider_id: userId,
        branch_id: branchId,
        report_date: dailyReport.report_date,
        total_sales: dailyReport.total_sales,
        cash_collected: dailyReport.cash_collected,
        total_transactions: dailyReport.total_transactions,
        photos: dailyReport.photos,
        start_location: dailyReport.start_location,
        end_location: dailyReport.end_location
      };

      const { error } = await supabase
        .from('daily_reports')
        .insert([reportData]);

      if (error) throw error;

      toast.success("Laporan harian berhasil dikirim!");
      
      // Reset form
setDailyReport({
  report_date: new Date().toISOString().split('T')[0],
  total_sales: 0,
  cash_collected: 0,
  total_transactions: 0,
  photos: [],
  operational_cost: 0,
  cash_deposit_required: 0,
  cash_sales: 0,
  qris_sales: 0,
  transfer_sales: 0
});
    } catch (error: any) {
      toast.error("Gagal mengirim laporan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (role === 'rider') {
    return (
      <div className="space-y-6">
        {/* Filter Period */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Laporan Penjualan
              </div>
              <Select value={filterPeriod} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setFilterPeriod(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Harian</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                </SelectContent>
              </Select>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Sales Summary */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resume Penjualan {filterPeriod === 'daily' ? 'Harian' : filterPeriod === 'weekly' ? 'Mingguan' : 'Bulanan'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">
                  {dailyReport.total_transactions}
                </p>
                <p className="text-sm text-muted-foreground">Total Transaksi</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-success">
                  Rp {dailyReport.total_sales.toLocaleString('id-ID')}
                </p>
                <p className="text-sm text-muted-foreground">Total Penjualan</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-warning">
                  Rp { (dailyReport.cash_sales ?? 0).toLocaleString('id-ID') }
                </p>
                <p className="text-sm text-muted-foreground">Penjualan Tunai</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-info">
                  Rp { (dailyReport.qris_sales ?? 0).toLocaleString('id-ID') }
                </p>
                <p className="text-sm text-muted-foreground">Penjualan QRIS</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-accent">
                  Rp { (dailyReport.transfer_sales ?? 0).toLocaleString('id-ID') }
                </p>
                <p className="text-sm text-muted-foreground">Transfer Bank</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-destructive">
                  Rp {dailyReport.cash_deposit_required.toLocaleString('id-ID')}
                </p>
                <p className="text-sm text-muted-foreground">Setoran (Tunai + Transfer)</p>
              </div>
            </div>

            {/* Location inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Lokasi Mulai</label>
                <Input
                  value={dailyReport.start_location || ''}
                  onChange={(e) => setDailyReport(prev => ({...prev, start_location: e.target.value}))}
                  placeholder="Lokasi mulai bekerja"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Lokasi Akhir</label>
                <Input
                  value={dailyReport.end_location || ''}
                  onChange={(e) => setDailyReport(prev => ({...prev, end_location: e.target.value}))}
                  placeholder="Lokasi akhir bekerja"
                />
              </div>
            </div>

            {/* Photo upload */}
            <div>
              <label className="text-sm font-medium block mb-2">Foto Laporan</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    Array.from(e.target.files).forEach(file => {
                      uploadReportPhoto(file);
                    });
                  }
                }}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {dailyReport.photos.length} foto terupload
              </p>
            </div>

            <Button 
              onClick={submitDailyReport} 
              disabled={loading || dailyReport.photos.length === 0}
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              {loading ? "Mengirim..." : "Kirim Laporan Harian"}
            </Button>
          </CardContent>
        </Card>

        {/* Transactions List with Payment Methods */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle>Transaksi Hari Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{transaction.transaction_number}</p>
                        <p className="text-lg font-bold text-primary">
                          Rp {transaction.total_amount.toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {transaction.payment_method === 'cash' && (
                          <Badge variant="default">
                            <DollarSign className="h-3 w-3 mr-1" />
                            Tunai
                          </Badge>
                        )}
                        {transaction.payment_method === 'qris' && (
                          <Badge variant="secondary">
                            <Smartphone className="h-3 w-3 mr-1" />
                            QRIS
                          </Badge>
                        )}
                        {transaction.payment_method === 'transfer' && (
                          <Badge variant="outline">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Transfer
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-3">
                      {new Date(transaction.created_at).toLocaleString('id-ID')}
                    </p>

                    {/* Upload payment proof for non-cash transactions */}
                    {transaction.payment_method !== 'cash' && !transaction.payment_proof && (
                      <div className="mt-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              uploadPaymentProof(transaction.id, file);
                            }
                          }}
                          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground"
                        />
                        <p className="text-xs text-warning mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Wajib upload bukti pembayaran
                        </p>
                      </div>
                    )}

                    {transaction.payment_proof && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-success">
                        <Check className="h-3 w-3" />
                        Bukti pembayaran tersimpan
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Branch Manager View - for verifying reports
  return (
    <div className="space-y-6">
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Verifikasi Laporan Rider</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Laporan pending verifikasi akan ditampilkan di sini.</p>
        </CardContent>
      </Card>
    </div>
  );
};