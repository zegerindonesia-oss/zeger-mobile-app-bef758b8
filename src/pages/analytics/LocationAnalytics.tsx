import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Filter, ExternalLink, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LocationMap } from "@/components/analytics/LocationMap";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface LocationData {
  location_name: string;
  latitude: number;
  longitude: number;
  customer_name: string;
  rider_name: string;
  products_sold: string;
  total_sales: number;
  transaction_count: number;
}

interface Rider {
  id: string;
  full_name: string;
}

export const LocationAnalytics = () => {
  const [selectedRider, setSelectedRider] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [riders, setRiders] = useState<Rider[]>([]);
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(false);

  // Set default dates
  useEffect(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    if (dateFilter === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (dateFilter === 'weekly') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      setStartDate(format(weekAgo, 'yyyy-MM-dd'));
      setEndDate(todayStr);
    } else if (dateFilter === 'monthly') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      setStartDate(format(monthAgo, 'yyyy-MM-dd'));
      setEndDate(todayStr);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchRiders();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchLocationData();
    }
  }, [selectedRider, startDate, endDate]);

  const fetchRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'rider')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setRiders(data || []);
    } catch (error: any) {
      console.error('Error fetching riders:', error);
      toast.error('Gagal memuat data rider');
    }
  };

  const fetchLocationData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          transaction_latitude,
          transaction_longitude,
          location_name,
          final_amount,
          customer_id,
          rider_id,
          transaction_date,
          customers!inner(name),
          profiles!inner(full_name),
          transaction_items(
            quantity,
            products(name)
          )
        `)
        .eq('status', 'completed')
        .not('transaction_latitude', 'is', null)
        .not('transaction_longitude', 'is', null)
        .gte('transaction_date', `${startDate}T00:00:00`)
        .lte('transaction_date', `${endDate}T23:59:59`);

      if (selectedRider !== "all") {
        query = query.eq('rider_id', selectedRider);
      }

      const { data: transactions, error } = await query;
      if (error) throw error;

      // Group by location coordinates and aggregate data
      const locationMap = new Map<string, LocationData>();

      transactions?.forEach((transaction: any) => {
        const lat = Number(transaction.transaction_latitude);
        const lng = Number(transaction.transaction_longitude);
        const key = `${lat.toFixed(6)}-${lng.toFixed(6)}`;
        
        const products = transaction.transaction_items
          ?.map((item: any) => `${item.products?.name || 'Unknown'} (${item.quantity})`)
          .join(', ') || '';

        if (locationMap.has(key)) {
          const existing = locationMap.get(key)!;
          existing.total_sales += Number(transaction.final_amount);
          existing.transaction_count += 1;
          existing.products_sold = `${existing.products_sold}, ${products}`;
        } else {
          locationMap.set(key, {
            location_name: transaction.location_name || 'Lokasi Tidak Diketahui',
            latitude: lat,
            longitude: lng,
            customer_name: transaction.customers?.name || 'Unknown',
            rider_name: transaction.profiles?.full_name || 'Unknown',
            products_sold: products,
            total_sales: Number(transaction.final_amount),
            transaction_count: 1
          });
        }
      });

      setLocationData(Array.from(locationMap.values()).sort((a, b) => b.total_sales - a.total_sales));
    } catch (error: any) {
      console.error('Error fetching location data:', error);
      toast.error('Gagal memuat data lokasi');
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-8 w-8 text-primary" />
          Location Analytics
        </h1>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Data
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="weekly">Minggu Ini</SelectItem>
                  <SelectItem value="monthly">Bulan Ini</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === 'custom' && (
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
          
          <div className="mt-4">
            <Button onClick={fetchLocationData} disabled={loading} className="w-full md:w-auto">
              <Filter className="h-4 w-4 mr-2" />
              {loading ? 'Memuat...' : 'Terapkan Filter'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle>Peta Lokasi Sales</CardTitle>
          <p className="text-sm text-muted-foreground">
            Klik marker untuk melihat detail dan buka di Google Maps
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <LocationMap data={locationData} onMarkerClick={openInGoogleMaps} />
          </div>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Transaksi per Lokasi</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Memuat data...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Nama Customer</TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Produk Terjual</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-center">Transaksi</TableHead>
                    <TableHead className="text-center">Maps</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Tidak ada data transaksi dengan lokasi pada periode yang dipilih
                      </TableCell>
                    </TableRow>
                  ) : (
                    locationData.map((location, index) => (
                      <TableRow key={`${location.latitude}-${location.longitude}`}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{location.customer_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{location.rider_name}</Badge>
                        </TableCell>
                        <TableCell>{location.location_name}</TableCell>
                        <TableCell className="max-w-xs truncate" title={location.products_sold}>
                          {location.products_sold}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(location.total_sales)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{location.transaction_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openInGoogleMaps(location.latitude, location.longitude)}
                            className="h-8 w-8 p-0"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};