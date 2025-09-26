import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Product { id: string; name: string; category: string; }
interface Branch { id: string; name: string; branch_type: string; }

export default function InventoryBranchTransfer() {
  const { userProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [smallBranches, setSmallBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Kirim Stok ke Small Branch | Zeger ERP";
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: p } = await supabase
        .from('products')
        .select('id, name, category')
        .eq('is_active', true)
        .order('name');
      setProducts(p || []);

      const { data: b } = await supabase
        .from('branches')
        .select('id, name, branch_type')
        .eq('is_active', true)
        .eq('branch_type', 'small');
      setSmallBranches(b || []);
    } catch (e: any) {
      toast.error("Gagal memuat data: " + e.message);
    }
  };

  const sendToBranch = async () => {
    if (!userProfile?.branch_id) return;
    const rows = Object.entries(quantities)
      .map(([productId, qty]) => ({ productId, qty }))
      .filter(r => (r.qty || 0) > 0);

    const totalItems = rows.reduce((sum, row) => sum + row.qty, 0);

    if (!selectedBranch) { toast.error('Pilih small branch'); return; }
    if (rows.length === 0) { toast.error('Isi jumlah minimal 1 produk'); return; }

    setLoading(true);
    try {
      const expected = new Date();
      expected.setHours(expected.getHours() + 1);

      const payload = rows.map(r => ({
        product_id: r.productId,
        quantity: Number(r.qty),
        movement_type: 'transfer' as const,
        branch_id: selectedBranch,
        rider_id: null,
        created_by: userProfile.id,
        status: 'sent',
        expected_delivery_date: expected.toISOString(),
        notes: 'Transfer stok dari branch hub ke small branch'
      }));

      const { error } = await supabase.from('stock_movements').insert(payload);
      if (error) throw error;

      toast.success(`Stok berhasil dikirim ke small branch! Total: ${totalItems} items`);
      setQuantities({});
      setSelectedBranch("");
    } catch (e: any) {
      toast.error('Gagal mengirim stok: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!userProfile) return null;

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Kirim Stok Ke Small Branch</h1>
        <p className="text-sm text-muted-foreground">Distribusikan stok dari branch hub ke cabang kecil.</p>
      </header>

      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Pilih Tujuan & Produk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Small Branch" />
                </SelectTrigger>
                <SelectContent>
                  {smallBranches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {products.map(p => (
              <div key={p.id} className="p-4 border rounded-lg space-y-2">
                <div>
                  <h4 className="font-medium">{p.name}</h4>
                  <p className="text-sm text-muted-foreground">{p.category}</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  placeholder="Jumlah"
                  value={quantities[p.id] || ''}
                  onChange={(e) => setQuantities(prev => ({ ...prev, [p.id]: Number(e.target.value || 0) }))}
                />
              </div>
            ))}
          </div>

          {/* Transfer Summary */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm font-medium text-blue-800">
              Transfer Summary:
            </div>
            <div className="text-sm text-blue-600">
              Total items to transfer: {
                Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0)
              } items
            </div>
          </div>

          <Button 
            onClick={sendToBranch} 
            disabled={loading} 
            className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg"
          >
            {loading ? 'Mengirim...' : 'Kirim Stok'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
