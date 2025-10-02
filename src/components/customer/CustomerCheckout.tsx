import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Truck, Wallet, CreditCard, QrCode, Tag, ChevronLeft } from "lucide-react";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  customizations?: any;
}

interface CustomerUser {
  id: string;
  points: number;
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface Voucher {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
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
  cart,
  outletId,
  outletName,
  outletAddress,
  customerUser,
  onConfirm,
  onBack,
}: CustomerCheckoutProps) {
  const { toast } = useToast();
  const [orderType, setOrderType] = useState<"outlet_pickup" | "outlet_delivery">("outlet_pickup");
  const [deliveryAddress, setDeliveryAddress] = useState(customerUser.address || "");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "e_wallet" | "qris">("cash");
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = orderType === "outlet_delivery" && subtotal < 50000 ? 10000 : 0;
  
  const calculateDiscount = () => {
    if (!appliedVoucher) return 0;
    if (appliedVoucher.discount_type === "percentage") {
      return Math.floor((subtotal * appliedVoucher.discount_value) / 100);
    }
    return appliedVoucher.discount_value;
  };

  const discount = calculateDiscount();
  const total = subtotal + deliveryFee - discount;
  const earnedPoints = Math.floor(total / 1000);

  useEffect(() => {
    fetchAvailableVouchers();
  }, []);

  const fetchAvailableVouchers = async () => {
    try {
      const { data, error } = await supabase
        .from("customer_vouchers")
        .select("*")
        .eq("is_active", true)
        .lte("valid_from", new Date().toISOString().split("T")[0])
        .gte("valid_until", new Date().toISOString().split("T")[0])
        .lte("min_order", subtotal);

      if (error) throw error;
      setAvailableVouchers(data || []);
    } catch (error) {
      console.error("Error fetching vouchers:", error);
    }
  };

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      toast({
        title: "Error",
        description: "Masukkan kode voucher",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("customer_vouchers")
        .select("*")
        .eq("code", voucherCode.toUpperCase())
        .eq("is_active", true)
        .lte("valid_from", new Date().toISOString().split("T")[0])
        .gte("valid_until", new Date().toISOString().split("T")[0])
        .single();

      if (error || !data) {
        toast({
          title: "Error",
          description: "Voucher tidak valid atau sudah kadaluarsa",
          variant: "destructive",
        });
        return;
      }

      if (data.min_order > subtotal) {
        toast({
          title: "Error",
          description: `Minimum pembelian Rp ${data.min_order.toLocaleString("id-ID")}`,
          variant: "destructive",
        });
        return;
      }

      setAppliedVoucher(data);
      toast({
        title: "✅ Voucher Berhasil Digunakan!",
        description: `Diskon ${data.discount_type === "percentage" ? data.discount_value + "%" : "Rp " + data.discount_value.toLocaleString("id-ID")}`,
      });
    } catch (error) {
      console.error("Error applying voucher:", error);
      toast({
        title: "Error",
        description: "Gagal menggunakan voucher",
        variant: "destructive",
      });
    }
  };

  const handleConfirmOrder = () => {
    if (orderType === "outlet_delivery" && !deliveryAddress.trim()) {
      toast({
        title: "Error",
        description: "Masukkan alamat pengiriman",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    onConfirm({
      outletId,
      orderType,
      deliveryAddress: orderType === "outlet_delivery" ? deliveryAddress : undefined,
      deliveryLat: customerUser.latitude,
      deliveryLng: customerUser.longitude,
      paymentMethod,
      voucherId: appliedVoucher?.id,
      totalPrice: total,
      deliveryFee,
      discount,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary text-primary-foreground p-4 shadow-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Checkout</h1>
            <p className="text-sm text-primary-foreground/80">{outletName}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Order Summary */}
        <Card className="p-4">
          <h2 className="font-semibold text-lg mb-3">Ringkasan Pesanan</h2>
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name} x{item.quantity}
                </span>
                <span className="font-medium">
                  Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="flex justify-between text-sm font-medium">
            <span>Subtotal</span>
            <span>Rp {subtotal.toLocaleString("id-ID")}</span>
          </div>
        </Card>

        {/* Order Type */}
        <Card className="p-4">
          <h2 className="font-semibold text-lg mb-3">Metode Pengambilan</h2>
          <RadioGroup value={orderType} onValueChange={(val) => setOrderType(val as any)}>
            <div className="space-y-3">
              <Label
                htmlFor="pickup"
                className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:border-primary transition-colors"
              >
                <RadioGroupItem value="outlet_pickup" id="pickup" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4" />
                    Pickup (Ambil Sendiri)
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{outletAddress}</p>
                  <Badge variant="secondary" className="mt-2">
                    Siap dalam 15-30 menit
                  </Badge>
                </div>
              </Label>

              <Label
                htmlFor="delivery"
                className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:border-primary transition-colors"
              >
                <RadioGroupItem value="outlet_delivery" id="delivery" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Truck className="h-4 w-4" />
                    Delivery (Antar ke Alamat)
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {deliveryFee === 0 ? "Gratis ongkir" : `Ongkir Rp ${deliveryFee.toLocaleString("id-ID")}`}
                  </p>
                </div>
              </Label>

              {orderType === "outlet_delivery" && (
                <div className="pl-9 space-y-2">
                  <Label htmlFor="address">Alamat Pengiriman</Label>
                  <Input
                    id="address"
                    placeholder="Masukkan alamat lengkap..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                </div>
              )}
            </div>
          </RadioGroup>
        </Card>

        {/* Payment Method */}
        <Card className="p-4">
          <h2 className="font-semibold text-lg mb-3">Metode Pembayaran</h2>
          <RadioGroup value={paymentMethod} onValueChange={(val) => setPaymentMethod(val as any)}>
            <div className="space-y-3">
              <Label
                htmlFor="cash"
                className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:border-primary transition-colors"
              >
                <RadioGroupItem value="cash" id="cash" />
                <Wallet className="h-5 w-5" />
                <span className="font-medium">Cash (Bayar di Tempat)</span>
              </Label>

              <Label
                htmlFor="e_wallet"
                className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:border-primary transition-colors opacity-50"
              >
                <RadioGroupItem value="e_wallet" id="e_wallet" disabled />
                <CreditCard className="h-5 w-5" />
                <div className="flex-1">
                  <span className="font-medium">E-Wallet</span>
                  <Badge variant="secondary" className="ml-2">
                    Segera Hadir
                  </Badge>
                </div>
              </Label>

              <Label
                htmlFor="qris"
                className="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:border-primary transition-colors opacity-50"
              >
                <RadioGroupItem value="qris" id="qris" disabled />
                <QrCode className="h-5 w-5" />
                <div className="flex-1">
                  <span className="font-medium">QRIS</span>
                  <Badge variant="secondary" className="ml-2">
                    Segera Hadir
                  </Badge>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </Card>

        {/* Voucher */}
        <Card className="p-4">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Voucher
          </h2>
          
          {appliedVoucher ? (
            <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    {appliedVoucher.code}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Diskon Rp {discount.toLocaleString("id-ID")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAppliedVoucher(null);
                    setVoucherCode("");
                  }}
                >
                  Hapus
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Masukkan kode voucher"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                />
                <Button onClick={handleApplyVoucher}>Gunakan</Button>
              </div>

              {availableVouchers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Voucher tersedia:</p>
                  {availableVouchers.map((voucher) => (
                    <div
                      key={voucher.id}
                      className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80"
                      onClick={() => {
                        setVoucherCode(voucher.code);
                        handleApplyVoucher();
                      }}
                    >
                      <p className="font-medium text-sm">{voucher.code}</p>
                      <p className="text-xs text-muted-foreground">
                        Diskon{" "}
                        {voucher.discount_type === "percentage"
                          ? voucher.discount_value + "%"
                          : "Rp " + voucher.discount_value.toLocaleString("id-ID")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Total */}
        <Card className="p-4 bg-primary text-primary-foreground">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString("id-ID")}</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span>Ongkir</span>
                <span>Rp {deliveryFee.toLocaleString("id-ID")}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-300">
                <span>Diskon</span>
                <span>- Rp {discount.toLocaleString("id-ID")}</span>
              </div>
            )}
            <Separator className="bg-primary-foreground/20" />
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>Rp {total.toLocaleString("id-ID")}</span>
            </div>
            <p className="text-sm text-primary-foreground/80">
              ⭐ Dapatkan {earnedPoints} poin dari pesanan ini
            </p>
          </div>
        </Card>

        {/* Confirm Button */}
        <Button
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleConfirmOrder}
          disabled={loading || (orderType === "outlet_delivery" && !deliveryAddress.trim())}
        >
          {loading ? "Memproses..." : "Konfirmasi Pesanan"}
        </Button>
      </div>
    </div>
  );
}
