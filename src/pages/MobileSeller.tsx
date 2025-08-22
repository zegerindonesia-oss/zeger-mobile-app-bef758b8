import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MapPin,
  Camera,
  Check,
  Search,
  Package,
  DollarSign,
  Clock,
  AlertCircle,
  FileText,
  Upload
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
}

interface StockItem {
  id: string;
  product_id: string;
  product: Product;
  rider_stock: number;
  checked: boolean;
}

const MobileSeller = () => {
  const [currentView, setCurrentView] = useState<'checkin' | 'stock-confirm' | 'selling' | 'returns' | 'checkout'>('checkin');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [dailySales, setDailySales] = useState({ transactions: 36, revenue: 407000 });
  const [searchTerm, setSearchTerm] = useState("");
  const [location, setLocation] = useState("Kemiri Sidoarjo");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRiderStock();
  }, []);

  const fetchRiderStock = async () => {
    try {
      // Simulate fetching rider's assigned stock
      const mockStock = [
        { id: '1', product_id: '1', product: { id: '1', name: 'americano', price: 8000, stock_quantity: 3 }, rider_stock: 3, checked: false },
        { id: '2', product_id: '2', product: { id: '2', name: 'classic latte', price: 8000, stock_quantity: 2 }, rider_stock: 2, checked: false },
        { id: '3', product_id: '3', product: { id: '3', name: 'dolce latte', price: 10000, stock_quantity: 4 }, rider_stock: 4, checked: false },
        { id: '4', product_id: '4', product: { id: '4', name: 'Aren creamy latte', price: 13000, stock_quantity: 5 }, rider_stock: 5, checked: false },
        { id: '5', product_id: '5', product: { id: '5', name: "Bailey's creamy latte", price: 15000, stock_quantity: 2 }, rider_stock: 2, checked: false },
        { id: '6', product_id: '6', product: { id: '6', name: 'butterscooth creamy latte', price: 15000, stock_quantity: 3 }, rider_stock: 3, checked: false },
        { id: '7', product_id: '7', product: { id: '7', name: 'matcha', price: 13000, stock_quantity: 4 }, rider_stock: 4, checked: false },
        { id: '8', product_id: '8', product: { id: '8', name: 'lychee tea', price: 8000, stock_quantity: 4 }, rider_stock: 4, checked: false },
        { id: '9', product_id: '9', product: { id: '9', name: 'lemonade', price: 8000, stock_quantity: 2 }, rider_stock: 2, checked: false },
        { id: '10', product_id: '10', product: { id: '10', name: 'cookies and cream', price: 12000, stock_quantity: 2 }, rider_stock: 2, checked: false },
        { id: '11', product_id: '11', product: { id: '11', name: 'Caramel mocca', price: 13000, stock_quantity: 0 }, rider_stock: 0, checked: false },
        { id: '12', product_id: '12', product: { id: '12', name: 'Caramel creamy latte baru', price: 13000, stock_quantity: 5 }, rider_stock: 5, checked: false },
      ];
      
      setStockItems(mockStock);
    } catch (error: any) {
      toast.error("Gagal memuat data stok");
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      // Simulate check-in process with photo and GPS
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success("Absen masuk berhasil!");
      setCurrentView('stock-confirm');
    } catch (error) {
      toast.error("Gagal absen masuk");
    } finally {
      setLoading(false);
    }
  };

  const toggleStockCheck = (id: string) => {
    setStockItems(items =>
      items.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const confirmStock = () => {
    const checkedItems = stockItems.filter(item => item.checked);
    if (checkedItems.length === stockItems.length) {
      toast.success("Stok dikonfirmasi!");
      setCurrentView('selling');
    } else {
      toast.error("Harap konfirmasi semua item stok");
    }
  };

  const proceedToReturns = () => {
    setCurrentView('returns');
  };

  const proceedToCheckout = () => {
    setCurrentView('checkout');
  };

  const filteredProducts = stockItems.filter(item =>
    item.product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderCheckIn = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Avatar className="h-20 w-20 mx-auto mb-4">
          <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
            R
          </AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-bold">Selamat Pagi, Rider!</h2>
        <p className="text-muted-foreground">Siap memulai hari?</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Lokasi Saat Ini</p>
              <p className="text-sm text-muted-foreground">{location}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Waktu</p>
              <p className="text-sm text-muted-foreground">{new Date().toLocaleString('id-ID')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button 
        className="w-full h-12 text-lg"
        onClick={handleCheckIn}
        disabled={loading}
      >
        {loading ? "Memproses..." : (
          <>
            <Camera className="mr-2 h-5 w-5" />
            Absen Masuk dengan Foto
          </>
        )}
      </Button>
    </div>
  );

  const renderStockConfirm = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Konfirmasi Stok Ulang</h2>
        <p className="text-muted-foreground">
          Harap konfirmasi bahwa barang-barang ini sudah distok ulang ke motormu. 
          Ketuk pada ceklis untuk menandakan benar.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-medium">Inventaris (Total {stockItems.length})</h3>
        <Badge>Dipilih ({stockItems.filter(item => item.checked).length}/{stockItems.length})</Badge>
      </div>

      <ScrollArea className="h-96">
        <div className="space-y-3">
          {stockItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                item.checked ? 'bg-primary/5 border-primary' : 'bg-card hover:bg-accent'
              }`}
              onClick={() => toggleStockCheck(item.id)}
            >
              <div>
                <p className="font-medium">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">{item.rider_stock} Barang</p>
              </div>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                item.checked 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : 'border-muted-foreground'
              }`}>
                {item.checked && <Check className="h-4 w-4" />}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="space-y-3">
        <Button 
          className="w-full h-12 bg-primary text-primary-foreground"
          onClick={confirmStock}
          disabled={stockItems.filter(item => item.checked).length !== stockItems.length}
        >
          Stok Ulang Benar
        </Button>
        <Button 
          variant="outline" 
          className="w-full h-12"
          onClick={() => setCurrentView('checkin')}
        >
          Stok Ulang Tidak Sesuai
        </Button>
      </div>
    </div>
  );

  const renderSelling = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Zeger Coffee</h2>
          <p className="text-muted-foreground">Produk untuk Dijual</p>
        </div>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-1" />
          Keranjang
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-96">
        <div className="space-y-3">
          {filteredProducts.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-card rounded-lg border">
              <div className="flex-1">
                <p className="font-medium">{item.product.name}</p>
                <p className="text-lg font-bold text-primary">Rp {item.product.price.toLocaleString('id-ID')}</p>
                <p className="text-sm text-muted-foreground">Stok: {item.rider_stock}</p>
              </div>
              <Button 
                disabled={item.rider_stock <= 0}
                className="px-8"
              >
                Tambah
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-4 bg-muted rounded-lg">
          <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Blitz Driver</p>
        </div>
        <div className="p-4 bg-muted rounded-lg">
          <Package className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">E-Bike Blitz</p>
        </div>
        <div className="p-4 bg-primary rounded-lg text-primary-foreground">
          <Package className="h-6 w-6 mx-auto mb-2" />
          <p className="text-xs font-medium">Blitz Seller</p>
        </div>
      </div>

      <Button 
        className="w-full h-12"
        onClick={proceedToReturns}
      >
        Akhiri Penjualan Hari Ini
      </Button>
    </div>
  );

  const renderReturns = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Kembalikan Barang Tak Terjual</h2>
        <p className="text-muted-foreground">
          Silakan ambil foto bukti terpisah untuk setiap inventaris yang akan dikembalikan.
        </p>
      </div>

      <ScrollArea className="h-96">
        <div className="space-y-4">
          {/* Sample return items */}
          <div className="p-4 border rounded-lg">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-medium">americano: 2 Barang untuk dikembalikan.</p>
              </div>
            </div>
            <div className="w-20 h-20 bg-muted rounded-lg mb-3 flex items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <Button className="w-full bg-primary">Ambil Foto</Button>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-medium">butterscooth creamy latte: 1 Barang untuk dikembalikan.</p>
              </div>
            </div>
            <div className="w-20 h-20 bg-muted rounded-lg mb-3 flex items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <Button className="w-full bg-primary">Ambil Foto</Button>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-medium">matcha: 1 Barang untuk dikembalikan.</p>
              </div>
            </div>
            <div className="w-20 h-20 bg-muted rounded-lg mb-3 flex items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <Button className="w-full bg-primary">Ambil Foto</Button>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-medium">lychee tea: 3 Barang untuk dikembalikan.</p>
              </div>
            </div>
            <div className="w-20 h-20 bg-muted rounded-lg mb-3 flex items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <Button className="w-full bg-primary">Ambil Foto</Button>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-medium">lemonade: 2 Barang untuk dikembalikan.</p>
              </div>
            </div>
            <div className="w-20 h-20 bg-muted rounded-lg mb-3 flex items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <Button className="w-full bg-primary">Ambil Foto</Button>
          </div>
        </div>
      </ScrollArea>

      <Button 
        className="w-full h-12 bg-primary"
        onClick={proceedToCheckout}
      >
        Simpan
      </Button>
    </div>
  );

  const renderCheckout = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Kamu Telah Mengakhiri Penjualan dengan Luar Biasa Hari Ini!</h2>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center p-4 border rounded-lg">
            <span className="font-medium">{dailySales.transactions} Barang Terjual</span>
            <span className="font-bold text-lg">Rp {dailySales.revenue.toLocaleString('id-ID')}</span>
          </div>
          <Button variant="link" className="w-full text-primary mt-2">
            Lihat rincian
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex justify-between">
          <span>Barang Tidak Terjual untuk Dikembalikan:</span>
          <span className="font-medium">0 Barang</span>
        </div>
        <div className="flex justify-between">
          <span>Uang Tunai untuk Disetor:</span>
          <span className="font-bold">Rp 328.000</span>
        </div>
      </div>

      <div className="bg-primary/10 p-4 rounded-lg">
        <p className="text-primary font-medium">Kamu harus kembali ke toko untuk:</p>
        <p className="text-primary">• Setor uang tunai</p>
        <p className="text-sm text-primary mt-2">
          Kemiri Indan Blok C7 No 8 RT/RW 20/05 Kemiri Sidoarjo
        </p>
      </div>

      <Button 
        className="w-full h-12 bg-primary"
        onClick={() => {
          toast.success("Laporan harian telah dikirim!");
          setCurrentView('checkin');
        }}
      >
        Lanjutkan Pengembalian
      </Button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gradient-to-b from-primary to-primary-light text-white p-4">
      <div className="glass rounded-xl p-4 text-gray-900 min-h-[calc(100vh-2rem)]">
        {currentView === 'checkin' && renderCheckIn()}
        {currentView === 'stock-confirm' && renderStockConfirm()}
        {currentView === 'selling' && renderSelling()}
        {currentView === 'returns' && renderReturns()}
        {currentView === 'checkout' && renderCheckout()}
      </div>
    </div>
  );
};

export default MobileSeller;