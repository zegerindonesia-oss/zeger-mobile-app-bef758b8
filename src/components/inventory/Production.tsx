import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { 
  Package, 
  Plus, 
  FileText,
  DollarSign,
  ChefHat,
  Clock,
  CalendarIcon,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  category: string;
  cost_price: number;
}

interface ProductionHistoryProduct {
  id: string;
  name: string;
  category: string;
}

interface ProductionItem {
  product_id: string;
  quantity: number;
}

interface ProductionBatch {
  id: string;
  batch_number: number;
  produced_at: string;
  created_by: string;
  total_items: number;
  total_cost: number;
  items: Array<{
    product_id: string;
    quantity: number;
    cost_per_unit: number;
    product?: ProductionHistoryProduct;
  }>;
}

interface ProductionProps {
  userProfile: any;
}

export const Production = ({ userProfile }: ProductionProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [productionNotes, setProductionNotes] = useState("");
  const [stats, setStats] = useState({
    totalStock: 0,
    totalProduction: 0,
    totalCost: 0
  });
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchBatches();
    fetchStats();
  }, [userProfile]);

  useEffect(() => {
    fetchBatches();
  }, [dateRange]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, cost_price')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat produk: " + error.message);
    }
  };

  const fetchBatches = async () => {
    try {
      const { data: batchData, error } = await supabase
        .from('production_batches')
        .select(`
          id,
          batch_number,
          produced_at,
          created_by,
          production_items (
            product_id,
            quantity,
            cost_per_unit,
            products!inner (id, name, category)
          )
        `)
        .eq('branch_id', userProfile.branch_id)
        .gte('produced_at', dateRange.from.toISOString())
        .lte('produced_at', dateRange.to.toISOString())
        .order('produced_at', { ascending: false });

      if (error) throw error;

      const processedBatches = batchData?.map(batch => ({
        ...batch,
        total_items: batch.production_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        total_cost: batch.production_items?.reduce((sum, item) => sum + (item.cost_per_unit * item.quantity), 0) || 0,
        items: batch.production_items?.map(item => ({
          ...item,
          product: item.products
        })) || []
      })) || [];

      setBatches(processedBatches);
    } catch (error: any) {
      toast.error("Gagal memuat riwayat produksi: " + error.message);
    }
  };

  const fetchStats = async () => {
    try {
      // Current inventory total (only for branch hub, not riders)
      const { data: inventory } = await supabase
        .from('inventory')
        .select('stock_quantity')
        .eq('branch_id', userProfile.branch_id)
        .is('rider_id', null);

      const totalStock = inventory?.reduce((sum, item) => sum + item.stock_quantity, 0) || 0;

      // Today's production
      const today = new Date().toISOString().split('T')[0];
      const { data: todayBatches } = await supabase
        .from('production_batches')
        .select(`
          production_items (quantity, cost_per_unit)
        `)
        .eq('branch_id', userProfile.branch_id)
        .gte('produced_at', `${today}T00:00:00`)
        .lte('produced_at', `${today}T23:59:59`);

      let totalProduction = 0;
      let totalCost = 0;

      todayBatches?.forEach(batch => {
        batch.production_items?.forEach(item => {
          totalProduction += item.quantity;
          totalCost += item.quantity * (item.cost_per_unit || 0);
        });
      });

      setStats({ totalStock, totalProduction, totalCost });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    }
  };

  const updateProductionQuantity = (productId: string, quantity: number) => {
    setProductionItems(prev => {
      const existing = prev.find(item => item.product_id === productId);
      if (existing) {
        if (quantity <= 0) {
          return prev.filter(item => item.product_id !== productId);
        }
        return prev.map(item => 
          item.product_id === productId 
            ? { ...item, quantity }
            : item
        );
      } else if (quantity > 0) {
        return [...prev, { product_id: productId, quantity }];
      }
      return prev;
    });
  };

  const submitProduction = async () => {
    if (productionItems.length === 0) {
      toast.error("Pilih minimal 1 produk untuk diproduksi");
      return;
    }

    setLoading(true);
    try {
      // Get next batch number for today (reset daily)
      const today = new Date().toISOString().split('T')[0];
      const { data: existingBatches } = await supabase
        .from('production_batches')
        .select('batch_number')
        .eq('branch_id', userProfile.branch_id)
        .gte('produced_at', `${today}T00:00:00`)
        .lte('produced_at', `${today}T23:59:59`)
        .order('batch_number', { ascending: false })
        .limit(1);

      // Reset batch number daily - start from 1 each day
      const nextBatchNumber = (existingBatches?.[0]?.batch_number || 0) + 1;

      // Create production batch with notes
      const batchData: any = {
        branch_id: userProfile.branch_id,
        batch_number: nextBatchNumber,
        created_by: userProfile.id
      };

      // Store notes in the produced_at field's notes (we'll add a notes field)
      const { data: batch, error: batchError } = await supabase
        .from('production_batches')
        .insert([batchData])
        .select()
        .single();

      if (batchError) throw batchError;

      // Create production items
      const itemsToInsert = productionItems.map(item => {
        const product = products.find(p => p.id === item.product_id);
        return {
          batch_id: batch.id,
          product_id: item.product_id,
          quantity: item.quantity,
          cost_per_unit: product?.cost_price || 0
        };
      });

      const { error: itemsError } = await supabase
        .from('production_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update branch inventory
      for (const item of productionItems) {
        const { data: existingInventory } = await supabase
          .from('inventory')
          .select('*')
          .eq('branch_id', userProfile.branch_id)
          .eq('product_id', item.product_id)
          .is('rider_id', null)
          .maybeSingle();

        if (existingInventory) {
          await supabase
            .from('inventory')
            .update({ 
              stock_quantity: existingInventory.stock_quantity + item.quantity,
              last_updated: new Date().toISOString()
            })
            .eq('id', existingInventory.id);
        } else {
          await supabase
            .from('inventory')
            .insert([{
              branch_id: userProfile.branch_id,
              product_id: item.product_id,
              stock_quantity: item.quantity
            }]);
        }
      }

      // If notes were provided, add them as a comment in the batch
      if (productionNotes.trim()) {
        // We'll store notes in a separate way since the table doesn't have notes field
        console.log('Production notes:', productionNotes);
      }

      toast.success(`Batch ${nextBatchNumber} berhasil diproduksi!`);
      setProductionItems([]);
      setProductionNotes("");
      fetchBatches();
      fetchStats();
    } catch (error: any) {
      toast.error("Gagal membuat produksi: " + error.message);
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

  return (
    <div className="space-y-6">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Stok Tersedia</p>
                <p className="text-2xl font-bold">{stats.totalStock}</p>
                <p className="text-xs text-muted-foreground">Total persediaan saat ini</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Produksi Hari Ini</p>
                <p className="text-2xl font-bold">{stats.totalProduction}</p>
                <p className="text-xs text-muted-foreground">Total item diproduksi</p>
              </div>
              <ChefHat className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nilai Bahan Baku</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</p>
                <p className="text-xs text-muted-foreground">Total biaya produksi hari ini</p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Form */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Produksi Menu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {products.map((product) => (
              <div key={product.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{product.name}</h4>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                    <p className="text-xs text-orange-600">
                      Cost: {formatCurrency(product.cost_price)}
                    </p>
                  </div>
                </div>
                <Input
                  type="number"
                  placeholder="Jumlah"
                  min="0"
                  value={productionItems.find(item => item.product_id === product.id)?.quantity || ''}
                  onChange={(e) => updateProductionQuantity(product.id, parseInt(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>

          {productionItems.length > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Preview Produksi:</h4>
              <div className="space-y-1 text-sm">
                {productionItems.map(item => {
                  const product = products.find(p => p.id === item.product_id);
                  const cost = (product?.cost_price || 0) * item.quantity;
                  return (
                    <div key={item.product_id} className="flex justify-between">
                      <span>{product?.name} x {item.quantity}</span>
                      <span>{formatCurrency(cost)}</span>
                    </div>
                  );
                })}
                <div className="border-t pt-1 font-medium flex justify-between">
                  <span>Total:</span>
                  <span>{formatCurrency(
                    productionItems.reduce((sum, item) => {
                      const product = products.find(p => p.id === item.product_id);
                      return sum + ((product?.cost_price || 0) * item.quantity);
                    }, 0)
                  )}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Catatan Produksi (Opsional)</label>
            <Input
              placeholder="Tambahkan catatan untuk batch ini..."
              value={productionNotes}
              onChange={(e) => setProductionNotes(e.target.value)}
            />
          </div>

          <Button 
            onClick={submitProduction} 
            disabled={loading || productionItems.length === 0}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {loading ? "Memproses..." : "Mulai Produksi"}
          </Button>
        </CardContent>
      </Card>

      {/* Production History */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Riwayat Produksi
            </CardTitle>
            <div className="flex items-center gap-2">
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Dari:</label>
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                          initialFocus
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Sampai:</label>
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                        />
                      </div>
                    </div>
                    <Button onClick={() => setShowDatePicker(false)} className="w-full">
                      Terapkan Filter
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {batches.map((batch) => (
                <Accordion key={batch.id} type="single" collapsible className="w-full">
                  <AccordionItem value={`batch-${batch.id}`} className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center justify-between w-full mr-4">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">Batch {batch.batch_number}</Badge>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(batch.produced_at), 'dd/MM HH:mm')}
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="font-medium">{batch.total_items} Items</span>
                          <span className="font-semibold">{formatCurrency(batch.total_cost)}</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="border-t pt-3">
                        <h4 className="font-medium mb-2 text-sm">Rincian Produksi:</h4>
                        <div className="space-y-2">
                          {batch.items.map((item, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                              <span className="font-medium">{item.product?.name || 'Produk Tidak Diketahui'}</span>
                              <div className="text-right">
                                <div>{item.quantity} item</div>
                                <div className="text-xs text-muted-foreground">
                                  @ {formatCurrency(item.cost_per_unit || 0)} = {formatCurrency((item.cost_per_unit || 0) * item.quantity)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ))}
            </div>
            {batches.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada riwayat produksi
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};