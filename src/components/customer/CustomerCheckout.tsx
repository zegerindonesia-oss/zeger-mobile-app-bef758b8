import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Store, ShoppingBag, Bike, Gift, ChevronRight, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  customizations?: any;
}

interface CustomerUser {
  id: string;
  points: number;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface CustomerCheckoutProps {
  cart: CartItem[];
  outletId: string;
  outletName: string;
  outletAddress: string;
  customerUser: CustomerUser;
  onConfirm: (orderData: any) => void;
  onBack: () => void;
}

export default function CustomerCheckout({
  cart, outletId, outletName, outletAddress, customerUser, onConfirm, onBack
}: CustomerCheckoutProps) {
  const { toast } = useToast();
  const [orderType, setOrderType] = useState<"outlet_pickup" | "outlet_delivery">("outlet_pickup");
  const [deliveryAddress, setDeliveryAddress] = useState(customerUser.address || "");
  const [loading, setLoading] = useState(false);
  const [useZegerPoints, setUseZegerPoints] = useState(false);

  const subtotal = cart.reduce((sum, item) => {
    let itemPrice = item.price;
    if (item.customizations?.size === 'large') itemPrice += 5000;
    if (item.customizations?.size === 'ultimate') itemPrice += 10000;
    return sum + (itemPrice * item.quantity);
  }, 0);
  
  const deliveryFee = orderType === "outlet_delivery" ? 25400 : 0;
  const takeAwayCharge = orderType === "outlet_pickup" ? 3500 : 0;
  const deliveryDiscount = orderType === "outlet_delivery" ? Math.floor(deliveryFee * 0.2) : 0;
  const maxPointsCanUse = Math.min(customerUser.points, Math.floor(subtotal / 500));
  const pointsDiscount = useZegerPoints ? maxPointsCanUse * 500 : 0;
  const total = subtotal + deliveryFee + takeAwayCharge - deliveryDiscount - pointsDiscount;
  const earnedPoints = Math.floor(total / 10000);

  const handleConfirmOrder = () => {
    if (orderType === "outlet_delivery" && !deliveryAddress.trim()) {
      toast({ title: "Error", description: "Masukkan alamat", variant: "destructive" });
      return;
    }
    setLoading(true);
    onConfirm({
      outletId, orderType, deliveryAddress: orderType === "outlet_delivery" ? deliveryAddress : undefined,
      deliveryLat: customerUser.latitude, deliveryLng: customerUser.longitude,
      paymentMethod: 'e_wallet', totalPrice: total, deliveryFee,
      discount: deliveryDiscount + pointsDiscount,
      pointsUsed: useZegerPoints ? maxPointsCanUse : 0, pointsEarned: earnedPoints
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f6f6] pb-32">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white sticky top-0 z-10 shadow-sm">
        <button onClick={onBack} className="text-gray-900">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Detail Pesanan</h1>
        <div className="w-8"></div>
      </header>

      <main className="p-4 space-y-4">
        {/* Order Type Toggle */}
        <div className="flex justify-around bg-gray-100 p-1 rounded-full">
          <button 
            onClick={() => setOrderType('outlet_pickup')}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-full w-1/2 text-sm font-medium transition-all",
              orderType === 'outlet_pickup' 
                ? "bg-[#EA2831] text-white shadow-md" 
                : "text-gray-500"
            )}
          >
            <ShoppingBag className="h-4 w-4" /> Take Away
          </button>
          <button 
            onClick={() => setOrderType('outlet_delivery')}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 rounded-full w-1/2 text-sm font-medium transition-all",
              orderType === 'outlet_delivery' 
                ? "bg-[#EA2831] text-white shadow-md" 
                : "text-gray-500"
            )}
          >
            <Bike className="h-4 w-4" /> Delivery
          </button>
        </div>

        {/* Outlet Info Card */}
        <div className="bg-white rounded-lg p-4 space-y-4 shadow-sm">
          <div className="flex items-center">
            <span className="text-2xl mr-3">{orderType === 'outlet_pickup' ? '🚶' : '🏍️'}</span>
            <div className="flex-grow">
              <h2 className="font-semibold text-gray-900">
                {orderType === 'outlet_pickup' ? 'Take Away' : 'Delivery'}
              </h2>
            </div>
            <span className="text-xs text-gray-400">0.01 km</span>
          </div>
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center">
              <Store className="h-5 w-5 text-gray-500 mr-3" />
              <span className="font-medium text-gray-900">SULAWESI SURABAYA</span>
            </div>
            <button className="text-[#EA2831] font-semibold text-sm">Ubah</button>
          </div>
        </div>

        {/* Pickup Time */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-900 mb-2">Pilih Waktu</label>
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-gray-500 mr-3" />
              <span className="font-medium text-gray-900">Ambil Sekarang</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-500" />
          </div>
        </div>

        {/* Order List */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Daftar Pesanan</h2>
            <button 
              onClick={onBack}
              className="bg-[#EA2831] text-white px-4 py-2 rounded-full text-sm font-semibold shadow"
            >
              Tambah Menu
            </button>
          </div>
          {cart.map((item) => (
            <div key={item.id} className="flex items-center mb-3">
              <img 
                src={item.image_url || '/placeholder.svg'} 
                alt={item.name}
                className="w-16 h-16 rounded-lg object-cover mr-4"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                <p className="text-xs text-gray-500">
                  {item.customizations?.temperature} Temp, {item.customizations?.size} Size, {item.customizations?.blend} Blend
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Payment Summary */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-gray-900">Total Pembayaran</h2>
            <AlertCircle className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex justify-between items-end mb-4">
            <span className="text-4xl font-extrabold text-[#EA2831]">
              Rp{total.toLocaleString('id-ID')}
            </span>
            <span className="text-sm text-gray-500 cursor-pointer">Rincian</span>
          </div>
          
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between text-gray-900">
              <span className="text-gray-500">Subtotal</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            {deliveryDiscount > 0 && (
              <div className="flex justify-between text-[#EA2831]">
                <span>Diskon Ongkir 20%</span>
                <span>-Rp {deliveryDiscount.toLocaleString('id-ID')}</span>
              </div>
            )}
            {takeAwayCharge > 0 && (
              <div className="flex justify-between text-gray-900">
                <span className="text-gray-500">Take Away Charge</span>
                <span>Rp {takeAwayCharge.toLocaleString('id-ID')}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-gray-900">
                <span className="text-gray-500">Delivery Fee</span>
                <span>Rp {deliveryFee.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>

          <hr className="my-4 border-gray-200" />
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center text-gray-500">
                <span>Zeger Point</span>
                <AlertCircle className="h-3 w-3 ml-1" />
              </div>
              <div className="flex items-center gap-1 text-orange-500">
                <span className="text-lg">💰</span>
                <span>Rp {earnedPoints * 500}</span>
              </div>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Total XP</span>
              <span className="text-green-500 font-semibold">{earnedPoints}</span>
            </div>
          </div>
        </div>

        {/* Promo Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-full">
              <Gift className="h-5 w-5 text-[#EA2831]" />
            </div>
            <span className="font-semibold text-gray-900">Promo dipakai</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>

        {/* Zeger Points Toggle */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-full">
              <span className="text-xl">💰</span>
            </div>
            <div>
              <span className="font-semibold text-gray-900">Zeger Point</span>
              <p className="text-sm text-gray-500">Saldo: {customerUser.points}</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={useZegerPoints}
              onChange={(e) => setUseZegerPoints(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#EA2831]"></div>
          </label>
        </div>
      </main>

      {/* Purple Alert + Button */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-purple-800 text-white p-3 flex items-start gap-3 rounded-t-2xl mx-auto max-w-sm shadow-2xl">
          <span className="text-xl">📢</span>
          <p className="text-xs">
            Dengan membayar pesanan, anda telah menyetujui{' '}
            <a href="#" className="font-bold underline">Syarat Dan Ketentuan</a> Kami
          </p>
        </div>
        
        <div className="bg-white p-4 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.1)] rounded-t-2xl mx-auto max-w-sm">
          <button 
            onClick={handleConfirmOrder}
            disabled={loading || (orderType === 'outlet_delivery' && !deliveryAddress)}
            className="w-full bg-[#EA2831] hover:bg-[#d11f28] disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-full font-bold text-lg shadow-lg transition-colors"
          >
            {loading ? 'Memproses...' : `Pilih Pembayaran • Rp${total.toLocaleString('id-ID')}`}
          </button>
          <div className="w-32 h-1.5 bg-gray-300 rounded-full mx-auto mt-4"></div>
        </div>
      </div>
    </div>
  );
}