import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trash2, Plus, TrendingDown, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, subDays } from "date-fns";

interface WasteManagementProps {
  userProfile: any;
  assignedRiderId?: string;
}

export const WasteManagement = ({ userProfile, assignedRiderId }: WasteManagementProps) => {
  const [riders, setRiders] = useState<any[]>([]);
  const [selectedRider, setSelectedRider] = useState("all");
  const [period, setPeriod] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [wasteData, setWasteData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedInputRider, setSelectedInputRider] = useState("");
  const [wasteDate, setWasteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [quantity, setQuantity] = useState("");
  const [wasteReason, setWasteReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchRiders();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (assignedRiderId) {
      setSelectedRider(assignedRiderId);
    }
    // For branch managers: default to "all" riders
  }, [assignedRiderId]);

  useEffect(() => {
    fetchWasteData();
  }, [selectedRider, period, startDate, endDate]);

  const getDateRange = () => {
    const today = new Date();
    switch(period) {
      case 'today':
        return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return { start: format(yesterday, 'yyyy-MM-dd'), end: format(yesterday, 'yyyy-MM-dd') };
      case 'month':
        const firstDay = startOfMonth(today);
        return { start: format(firstDay, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      case 'custom':
        return { start: startDate, end: endDate };
      default:
        return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    }
  };

  const fetchRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['rider', 'bh_rider', 'sb_rider']) // Support all rider types
        .eq('branch_id', userProfile.branch_id)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setRiders(data || []);
      // Default to "all" riders - no auto-select
    } catch (error: any) {
      toast.error("Gagal fetch data rider");
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, cost_price')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast.error("Gagal fetch data produk");
    }
  };

  const fetchWasteData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();
      
      if (!start || !end) return;

      let query = supabase
        .from('product_waste')
        .select(`
          *,
          products (name, cost_price),
          profiles!product_waste_rider_id_fkey (full_name)
        `)
        .gte('created_at', `${start}T00:00:00+07:00`)
        .lte('created_at', `${end}T23:59:59+07:00`)
        .order('created_at', { ascending: false });

      // Filter by rider - support "all" option
      if (assignedRiderId) {
        query = query.eq('rider_id', assignedRiderId);
      } else if (selectedRider && selectedRider !== 'all') {
        query = query.eq('rider_id', selectedRider);
      }
      // If selectedRider === 'all', no rider filter applied (show all riders)

      const { data, error } = await query;
      
      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        created_at: item.created_at,
        rider_name: item.profiles?.full_name || 'Unknown',
        product_name: item.products?.name || 'Unknown',
        quantity: item.quantity,
        hpp: item.hpp,
        total_waste: item.total_waste,
        waste_reason: item.waste_reason,
        notes: item.notes
      }));

      setWasteData(formattedData);
      processChartData(formattedData);
    } catch (error: any) {
      toast.error("Gagal fetch waste data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (data: any[]) => {
    if (!data || data.length === 0) {
      setChartData([]);
      return;
    }

    const grouped = data.reduce((acc: any, item: any) => {
      const date = format(new Date(item.created_at), 'dd MMM');
      if (!acc[date]) {
        acc[date] = { date };
      }
      const productName = item.product_name || 'Unknown';
      if (!acc[date][productName]) {
        acc[date][productName] = 0;
      }
      acc[date][productName] += Number(item.total_waste || 0);
      return acc;
    }, {});

    const chartArray = Object.values(grouped).sort((a: any, b: any) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    
    setChartData(chartArray);
  };

  const handleSubmitWaste = async () => {
    // Validation
    if (!assignedRiderId && !selectedInputRider) {
      toast.error("Mohon pilih rider");
      return;
    }
    
    if (!selectedProduct || !quantity || !wasteReason) {
      toast.error("Mohon lengkapi semua field yang wajib");
      return;
    }

    try {
      const product = products.find(p => p.id === selectedProduct);
      const riderId = assignedRiderId || selectedInputRider;

      const { error } = await supabase
        .from('product_waste')
        .insert({
          rider_id: riderId,
          branch_id: userProfile.branch_id,
          product_id: selectedProduct,
          quantity: parseInt(quantity),
          waste_reason: wasteReason,
          notes: notes,
          hpp: product?.cost_price || 0,
          created_by: userProfile.id,
          created_at: `${wasteDate}T00:00:00`
        });

      if (error) throw error;

      toast.success("Waste berhasil ditambahkan");
      
      // Reset form
      setSelectedInputRider("");
      setSelectedProduct("");
      setWasteDate(format(new Date(), 'yyyy-MM-dd'));
      setQuantity("");
      setWasteReason("");
      setNotes("");

      // Refresh data
      fetchWasteData();
    } catch (error: any) {
      toast.error("Gagal menambahkan waste: " + error.message);
    }
  };

  const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#84CC16', '#EA2831', '#EC4899', '#06B6D4'];

  const calculateSummary = () => {
    if (wasteData.length === 0) {
      return {
        totalQuantity: 0,
        totalHPP: 0,
        totalWaste: 0,
        avgQuantity: 0,
        avgHPP: 0,
        avgWaste: 0
      };
    }

    const totalQuantity = wasteData.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalHPP = wasteData.reduce((sum, item) => sum + (item.hpp || 0), 0);
    const totalWaste = wasteData.reduce((sum, item) => sum + (item.total_waste || 0), 0);
    
    return {
      totalQuantity,
      totalHPP,
      totalWaste,
      avgQuantity: Math.round(totalQuantity / wasteData.length),
      avgHPP: Math.round(totalHPP / wasteData.length),
      avgWaste: Math.round(totalWaste / wasteData.length)
    };
  };

  const summary = calculateSummary();

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Waste Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Rider Select - disabled for BH Report users */}
            <div>
              <Label>Rider</Label>
              <Select 
                value={selectedRider} 
                onValueChange={setSelectedRider}
                disabled={!!assignedRiderId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih rider" />
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

            {/* Period Select */}
            <div>
              <Label>Periode</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="yesterday">Kemarin</SelectItem>
                  <SelectItem value="month">Bulan Ini</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {period === 'custom' && (
              <>
                <div>
                  <Label>Tanggal Mulai</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Tanggal Akhir</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chart Section */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Grafik Product Waste
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              Tidak ada data waste untuk periode yang dipilih
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `Rp ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: any) => `Rp ${value.toLocaleString('id-ID')}`}
                />
                <Legend />
                {chartData.length > 0 && Object.keys(chartData[0])
                  .filter(key => key !== 'date')
                  .map((productName, idx) => (
                    <Line 
                      key={productName}
                      type="monotone" 
                      dataKey={productName} 
                      stroke={colors[idx % colors.length]} 
                      strokeWidth={2} 
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))
                }
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Input Form */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Input Product Waste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rider Select - only show if not assigned rider */}
            {!assignedRiderId && (
              <div>
                <Label>Rider *</Label>
                <Select 
                  value={selectedInputRider} 
                  onValueChange={setSelectedInputRider}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih rider" />
                  </SelectTrigger>
                  <SelectContent>
                    {riders.map(rider => (
                      <SelectItem key={rider.id} value={rider.id}>
                        {rider.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Tanggal *</Label>
              <Input 
                type="date" 
                value={wasteDate} 
                onChange={(e) => setWasteDate(e.target.value)}
              />
            </div>
            
            <div>
              <Label>Product *</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (HPP: Rp {p.cost_price?.toLocaleString('id-ID')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jumlah *</Label>
              <Input 
                type="number" 
                min="1"
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Alasan Waste *</Label>
              <Select value={wasteReason} onValueChange={setWasteReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih alasan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tumpah">Tumpah</SelectItem>
                  <SelectItem value="bocor">Bocor</SelectItem>
                  <SelectItem value="basi">Basi</SelectItem>
                  <SelectItem value="expired">Expired Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Keterangan</Label>
              <Input 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Keterangan tambahan (optional)"
              />
            </div>
          </div>
          <Button 
            className="mt-4"
            onClick={handleSubmitWaste}
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Waste
          </Button>
        </CardContent>
      </Card>

      {/* Report Table */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Laporan Waste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No</TableHead>
                  <TableHead>Tgl/Bln/Tahun</TableHead>
                  <TableHead>Nama Rider</TableHead>
                  <TableHead>Nama Product</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">HPP</TableHead>
                  <TableHead className="text-right">Total Waste</TableHead>
                  <TableHead>Alasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wasteData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Tidak ada data waste
                    </TableCell>
                  </TableRow>
                ) : (
                  wasteData.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{item.rider_name}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        Rp {item.hpp?.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        Rp {item.total_waste?.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={item.waste_reason === 'expired' ? 'destructive' : 'secondary'}
                        >
                          {item.waste_reason}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                
                {/* Summary Rows */}
                {wasteData.length > 0 && (
                  <>
                    {/* Total Row */}
                    <TableRow className="bg-red-50 border-t-2 border-red-200">
                      <TableCell colSpan={2} className="font-bold text-right">TOTAL:</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-bold">{summary.totalQuantity}</TableCell>
                      <TableCell className="text-right font-bold">
                        Rp {summary.totalHPP.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600 text-lg">
                        Rp {summary.totalWaste.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    
                    {/* Average Row */}
                    <TableRow className="bg-gray-50 border-t">
                      <TableCell colSpan={2} className="font-bold text-right">AVG:</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-semibold text-gray-700">{summary.avgQuantity}</TableCell>
                      <TableCell className="text-right font-semibold text-gray-700">
                        Rp {summary.avgHPP.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-gray-700">
                        Rp {summary.avgWaste.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
