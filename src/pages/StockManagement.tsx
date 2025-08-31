import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Minus, 
  RotateCcw, 
  Trash2, 
  CalendarIcon,
  Download,
  Eye,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StockStats {
  totalStockIn: number;
  totalStockOut: number;
  totalStockValue: number;
  totalWaste: number;
  remainingStock: number;
}

interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  cost_price: number;
}

interface StockMovement {
  id: string;
  product_id: string;
  quantity: number;
  movement_type: 'in' | 'out' | 'transfer' | 'adjustment' | 'return';
  notes: string;
  created_at: string;
  products: Product;
  rider_id?: string;
  profiles?: { full_name: string } | null;
}

export default function StockManagement() {
  const [stats, setStats] = useState<StockStats>({
    totalStockIn: 0,
    totalStockOut: 0,
    totalStockValue: 0,
    totalWaste: 0,
    remainingStock: 0
  });
  
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Date filter
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  // Stock input form
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [wasteQuantity, setWasteQuantity] = useState("");
  const [wasteNotes, setWasteNotes] = useState("");
  
  // Inventory adjustment states
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [adjustmentHistory, setAdjustmentHistory] = useState<any[]>([]);

  useEffect(() => {
    document.title = 'Stock Management | Zeger ERP';
    fetchProducts();
    fetchStockData();
    fetchInventoryItems();
    fetchAdjustmentHistory();
  }, [startDate, endDate]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal memuat data produk');
    }
  };

  const fetchStockData = async () => {
    setLoading(true);
    try {
      // Fetch stock movements in date range
      const { data: movements, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products (id, name, code, category, price, cost_price)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMovements(movements || []);

      // Calculate stats
      let totalStockIn = 0;
      let totalStockOut = 0;
      let totalWaste = 0;
      let totalValue = 0;

      movements?.forEach((movement) => {
        const value = movement.quantity * (movement.products?.cost_price || 0);
        
        switch (movement.movement_type) {
          case 'in':
            totalStockIn += movement.quantity;
            totalValue += value;
            break;
          case 'out':
          case 'transfer':
            totalStockOut += movement.quantity;
            break;
          case 'adjustment':
            totalWaste += movement.quantity;
            break;
        }
      });

      // Get current inventory
      const { data: inventory } = await supabase
        .from('inventory')
        .select('stock_quantity')
        .eq('branch_id', 'your-branch-id'); // Replace with actual branch ID

      const remainingStock = inventory?.reduce((sum, item) => sum + item.stock_quantity, 0) || 0;

      setStats({
        totalStockIn,
        totalStockOut,
        totalStockValue: totalValue,
        totalWaste,
        remainingStock
      });

    } catch (error) {
      console.error('Error fetching stock data:', error);
      toast.error('Gagal memuat data stok');
    } finally {
      setLoading(false);
    }
  };

  const handleStockIn = async () => {
    if (!selectedProduct || !quantity) {
      toast.error('Pilih produk dan masukkan jumlah');
      return;
    }

    try {
      const { error } = await supabase
        .from('stock_movements')
        .insert({
          product_id: selectedProduct,
          quantity: parseInt(quantity),
          movement_type: 'in',
          notes: notes || 'Stock masuk ke branch',
          reference_type: 'manual_input'
        });

      if (error) throw error;

      // Update inventory
      const { error: invError } = await supabase
        .from('inventory')
        .upsert({
          product_id: selectedProduct,
          branch_id: 'your-branch-id', // Replace with actual branch ID
          stock_quantity: parseInt(quantity)
        }, {
          onConflict: 'product_id,branch_id',
          ignoreDuplicates: false
        });

      if (invError) throw invError;

      toast.success('Stok berhasil ditambahkan');
      setSelectedProduct("");
      setQuantity("");
      setNotes("");
      fetchStockData();
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error('Gagal menambahkan stok');
    }
  };

  const handleWasteInput = async () => {
    if (!selectedProduct || !wasteQuantity) {
      toast.error('Pilih produk dan masukkan jumlah waste');
      return;
    }

    try {
      const { error } = await supabase
        .from('stock_movements')
        .insert({
          product_id: selectedProduct,
          quantity: parseInt(wasteQuantity),
          movement_type: 'adjustment',
          notes: wasteNotes || 'Stock waste',
          reference_type: 'waste_input'
        });

      if (error) throw error;

      toast.success('Waste stock berhasil dicatat');
      setSelectedProduct("");
      setWasteQuantity("");
      setWasteNotes("");
      fetchStockData();
    } catch (error) {
      console.error('Error recording waste:', error);
      toast.error('Gagal mencatat waste');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          products (id, name, code, category, price, cost_price)
        `)
        .eq('branch_id', 'your-branch-id') // Replace with actual branch ID
        .order('products.name');
        
      if (error) throw error;
      
      // Add real_stock field initialized with current stock_quantity
      const itemsWithRealStock = data?.map(item => ({
        ...item,
        real_stock: item.stock_quantity,
        variance: 0,
        variance_value: 0
      })) || [];
      
      setInventoryItems(itemsWithRealStock);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Gagal memuat data inventory');
    }
  };

  const fetchAdjustmentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products (name, code, cost_price)
        `)
        .eq('movement_type', 'adjustment')
        .eq('reference_type', 'inventory_adjustment')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setAdjustmentHistory(data || []);
    } catch (error) {
      console.error('Error fetching adjustment history:', error);
    }
  };

  const updateRealStock = (itemId: string, realStock: number) => {
    setInventoryItems(prev => 
      prev.map(item => {
        if (item.id === itemId) {
          const variance = realStock - item.stock_quantity;
          const varianceValue = variance * (item.products?.cost_price || 0);
          return {
            ...item,
            real_stock: realStock,
            variance,
            variance_value: varianceValue
          };
        }
        return item;
      })
    );
  };

  const handleInventoryAdjustment = async () => {
    const itemsToAdjust = inventoryItems.filter(item => item.variance !== 0);
    
    if (itemsToAdjust.length === 0) {
      toast.error('Tidak ada perbedaan stock untuk disesuaikan');
      return;
    }

    try {
      setLoading(true);
      
      // Create adjustment movements
      const adjustmentMovements = itemsToAdjust.map(item => ({
        product_id: item.product_id,
        quantity: Math.abs(item.variance),
        movement_type: item.variance > 0 ? 'in' : 'adjustment',
        notes: `Stock opname adjustment: ${item.variance > 0 ? 'tambah' : 'kurang'} ${Math.abs(item.variance)} items`,
        reference_type: 'inventory_adjustment',
        branch_id: 'your-branch-id' // Replace with actual branch ID
      }));

      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert(adjustmentMovements);

      if (movementError) throw movementError;

      // Update inventory quantities
      for (const item of itemsToAdjust) {
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            stock_quantity: item.real_stock,
            last_updated: new Date().toISOString()
          })
          .eq('id', item.id);

        if (updateError) throw updateError;
      }

      toast.success(`${itemsToAdjust.length} item berhasil disesuaikan`);
      fetchInventoryItems();
      fetchAdjustmentHistory();
      fetchStockData();
      
    } catch (error) {
      console.error('Error adjusting inventory:', error);
      toast.error('Gagal melakukan penyesuaian inventory');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const csvData = movements.map(movement => ({
      'Tanggal': format(new Date(movement.created_at), 'dd/MM/yyyy HH:mm'),
      'Produk': movement.products?.name || '',
      'Kode': movement.products?.code || '',
      'Jenis': movement.movement_type,
      'Jumlah': movement.quantity,
      'Keterangan': movement.notes || '',
      'Rider': movement.profiles?.full_name || ''
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-movements-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Chart data
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayMovements = movements.filter(m => 
      new Date(m.created_at).toDateString() === date.toDateString()
    );
    
    return {
      date: format(date, 'dd/MM'),
      stockIn: dayMovements.filter(m => m.movement_type === 'in').reduce((sum, m) => sum + m.quantity, 0),
      stockOut: dayMovements.filter(m => m.movement_type === 'out' || m.movement_type === 'transfer').reduce((sum, m) => sum + m.quantity, 0),
      waste: dayMovements.filter(m => m.movement_type === 'adjustment').reduce((sum, m) => sum + m.quantity, 0)
    };
  }).reverse();

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Management</h1>
          <p className="text-sm text-muted-foreground">Kelola inventory dan stok branch</p>
        </div>
        <Button onClick={exportToCSV} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </header>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label>Periode:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <span>sampai</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy") : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Stok Masuk</p>
                <p className="text-xl font-bold text-green-600">{stats.totalStockIn}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Total Stok Keluar</p>
                <p className="text-xl font-bold text-red-600">{stats.totalStockOut}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Nilai Stok</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalStockValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Total Waste</p>
                <p className="text-xl font-bold text-orange-600">{stats.totalWaste}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Sisa Stok</p>
                <p className="text-xl font-bold text-purple-600">{stats.remainingStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pergerakan Stok Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="stockIn" stackId="1" stroke="#10b981" fill="#10b981" />
                  <Area type="monotone" dataKey="stockOut" stackId="1" stroke="#ef4444" fill="#ef4444" />
                  <Area type="monotone" dataKey="waste" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary Mingguan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="stockIn" fill="#10b981" name="Stok Masuk" />
                  <Bar dataKey="stockOut" fill="#ef4444" name="Stok Keluar" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Management Tabs */}
      <Tabs defaultValue="stock-in" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="stock-in">Stok Masuk</TabsTrigger>
          <TabsTrigger value="waste">Waste Stock</TabsTrigger>
          <TabsTrigger value="inventory-adjustment">Inventory Adjustment</TabsTrigger>
          <TabsTrigger value="movements">Riwayat Pergerakan</TabsTrigger>
          <TabsTrigger value="transfer-history">Riwayat Transfer Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="stock-in">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Input Stok Masuk
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product">Produk</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih produk" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quantity">Jumlah</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Masukkan jumlah"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Keterangan</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Keterangan opsional"
                />
              </div>
              <Button onClick={handleStockIn} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Stok
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waste">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Input Waste Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="waste-product">Produk</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih produk" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="waste-quantity">Jumlah Waste</Label>
                  <Input
                    id="waste-quantity"
                    type="number"
                    value={wasteQuantity}
                    onChange={(e) => setWasteQuantity(e.target.value)}
                    placeholder="Masukkan jumlah waste"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="waste-notes">Alasan Waste</Label>
                <Input
                  id="waste-notes"
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  placeholder="Alasan atau keterangan waste"
                />
              </div>
              <Button onClick={handleWasteInput} variant="destructive" className="w-full">
                <Trash2 className="w-4 h-4 mr-2" />
                Catat Waste
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Pergerakan Stok</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : movements.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Tidak ada data pergerakan stok
                  </div>
                ) : (
                  movements.map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          movement.movement_type === 'in' && "bg-green-100 text-green-600",
                          movement.movement_type === 'out' && "bg-red-100 text-red-600",
                          movement.movement_type === 'transfer' && "bg-blue-100 text-blue-600",
                          movement.movement_type === 'adjustment' && "bg-orange-100 text-orange-600"
                        )}>
                          {movement.movement_type === 'in' && <TrendingUp className="w-5 h-5" />}
                          {movement.movement_type === 'out' && <TrendingDown className="w-5 h-5" />}
                          {movement.movement_type === 'transfer' && <RotateCcw className="w-5 h-5" />}
                          {movement.movement_type === 'adjustment' && <Trash2 className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-medium">{movement.products?.name}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(movement.created_at), 'dd/MM/yyyy HH:mm')}
                          </p>
                          {movement.notes && (
                            <p className="text-sm text-gray-400">{movement.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          movement.movement_type === 'in' ? 'default' :
                          movement.movement_type === 'adjustment' ? 'destructive' : 'secondary'
                        }>
                          {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity}
                        </Badge>
                        {movement.profiles && (
                          <p className="text-sm text-gray-500 mt-1">{movement.profiles.full_name}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory-adjustment">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Inventory Adjustment (Stock Opname)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Inventory with Real Stock Input */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Stock Opname</h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-border">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border border-border p-2 text-left">Produk</th>
                        <th className="border border-border p-2 text-center">Stok Sistem</th>
                        <th className="border border-border p-2 text-center">Stok Real</th>
                        <th className="border border-border p-2 text-center">Selisih</th>
                        <th className="border border-border p-2 text-center">Nilai Selisih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.map((item) => (
                        <tr key={item.id}>
                          <td className="border border-border p-2">
                            <div>
                              <p className="font-medium">{item.products?.name}</p>
                              <p className="text-sm text-muted-foreground">{item.products?.code}</p>
                            </div>
                          </td>
                          <td className="border border-border p-2 text-center font-medium">
                            {item.stock_quantity}
                          </td>
                          <td className="border border-border p-2">
                            <Input
                              type="number"
                              value={item.real_stock}
                              onChange={(e) => updateRealStock(item.id, parseInt(e.target.value) || 0)}
                              className="w-20 mx-auto text-center"
                            />
                          </td>
                          <td className={cn(
                            "border border-border p-2 text-center font-medium",
                            item.variance > 0 ? "text-green-600" : 
                            item.variance < 0 ? "text-red-600" : "text-muted-foreground"
                          )}>
                            {item.variance > 0 ? '+' : ''}{item.variance}
                          </td>
                          <td className={cn(
                            "border border-border p-2 text-center font-medium",
                            item.variance_value > 0 ? "text-green-600" : 
                            item.variance_value < 0 ? "text-red-600" : "text-muted-foreground"
                          )}>
                            {formatCurrency(item.variance_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h5 className="font-semibold text-blue-800 mb-2">Total Variance</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-blue-600">Total Items dengan Selisih:</p>
                      <p className="font-bold text-blue-800">
                        {inventoryItems.filter(item => item.variance !== 0).length} items
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-600">Total Nilai Selisih:</p>
                      <p className="font-bold text-blue-800">
                        {formatCurrency(inventoryItems.reduce((sum, item) => sum + item.variance_value, 0))}
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleInventoryAdjustment}
                  disabled={loading || inventoryItems.filter(item => item.variance !== 0).length === 0}
                  className="w-full"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Proses Penyesuaian Inventory
                </Button>
              </div>

              {/* Adjustment History */}
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Riwayat Penyesuaian</h4>
                
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-4">Loading...</div>
                  ) : adjustmentHistory.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Belum ada riwayat penyesuaian
                    </div>
                  ) : (
                    adjustmentHistory.map((adjustment) => (
                      <div key={adjustment.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{adjustment.products?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(adjustment.created_at), 'dd/MM/yyyy HH:mm')}
                          </p>
                          <p className="text-xs text-muted-foreground">{adjustment.notes}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={adjustment.movement_type === 'in' ? 'default' : 'destructive'}>
                            {adjustment.movement_type === 'in' ? '+' : '-'}{adjustment.quantity}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatCurrency((adjustment.products?.cost_price || 0) * adjustment.quantity)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer-history">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Transfer Stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filter Section */}
              <div className="flex gap-4 items-end">
                <div>
                  <Label>Filter User:</Label>
                  <Select>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Semua User" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua User</SelectItem>
                      <SelectItem value="pak-fajar">Pak Fajar</SelectItem>
                      <SelectItem value="pak-budi">Pak Budi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tanggal Awal:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-40">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startDate, "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Tanggal Akhir:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-40">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(endDate, "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={endDate} onSelect={(date) => date && setEndDate(date)} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Transfer History Data */}
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium">30/08/2025 - Pak Fajar</h4>
                      <p className="text-sm text-muted-foreground">Transfer & Penjualan Harian</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-2">
                      <h5 className="font-medium text-green-600">Stok Diterima:</h5>
                      <ul className="space-y-1">
                        <li>• Kopi Arabica: 20 pcs</li>
                        <li>• Gula: 10 kg</li>
                        <li>• Susu: 15 liter</li>
                      </ul>
                      <p className="font-medium">Total: 45 items</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h5 className="font-medium text-blue-600">Terjual:</h5>
                      <ul className="space-y-1">
                        <li>• Americano: 15 cup</li>
                        <li>• Cappuccino: 8 cup</li>
                        <li>• Latte: 12 cup</li>
                      </ul>
                      <p className="font-medium">Total: 35 items</p>
                    </div>
                    
                    <div className="space-y-2">
                      <h5 className="font-medium text-red-600">Dikembalikan:</h5>
                      <ul className="space-y-1">
                        <li>• Kopi Arabica: 5 pcs</li>
                        <li>• Gula: 2 kg</li>
                      </ul>
                      <p className="font-medium">Total: 7 items</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}