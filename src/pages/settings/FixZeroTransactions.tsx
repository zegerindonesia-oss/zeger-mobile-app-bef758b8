import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function FixZeroTransactions() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const fixZ012Transactions = async () => {
    setLoading(true);
    setResults(null);

    try {
      // Get Z-012's rider_id
      const { data: rider } = await supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', '%012%')
        .single();

      if (!rider) {
        toast.error("Rider Z-012 tidak ditemukan");
        return;
      }

      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

      const { data, error } = await supabase.functions.invoke('fix-zero-transactions', {
        body: {
          rider_id: rider.id,
          start_date: `${today}T00:00:00+07:00`,
          end_date: `${today}T23:59:59+07:00`
        }
      });

      if (error) throw error;

      if (data?.success) {
        setResults(data);
        toast.success(data.message);
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Fix error:', error);
      toast.error("Gagal memperbaiki transaksi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (userProfile?.role !== 'ho_admin') {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Hanya HO Admin yang dapat mengakses halaman ini
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Fix Zero Transactions</h1>
          <p className="text-muted-foreground">Perbaiki transaksi dengan Rp 0 akibat diskon berlebihan</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Quick Fix: Transaksi Z-012 Aufa Hari Ini
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Tombol ini akan memperbaiki semua transaksi Z-012 Aufa hari ini yang memiliki final_amount = Rp 0 akibat diskon berlebihan.
              Diskon akan direset menjadi 0 agar total transaksi kembali normal.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={fixZ012Transactions}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? "Memproses..." : "Perbaiki Transaksi Z-012 Hari Ini"}
          </Button>

          {results && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-800">{results.message}</p>
                </div>

                {results.fixed && results.fixed.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Transaksi yang diperbaiki:</p>
                    <div className="space-y-2">
                      {results.fixed.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <Badge variant="outline">{item.transaction_number}</Badge>
                          <span className="text-muted-foreground">
                            Rp 0 → Rp {item.new_final.toLocaleString('id-ID')}
                            {item.discount_reset && " (diskon direset)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.skipped && results.skipped.length > 0 && (
                  <div>
                    <p className="font-medium mb-2 text-yellow-700">Dilewati:</p>
                    <div className="space-y-1">
                      {results.skipped.map((item: any, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          {item.transaction_number}: {item.reason || item.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
