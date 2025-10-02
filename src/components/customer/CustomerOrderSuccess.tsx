import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, MapPin, Truck, Clock, Home, FileText } from "lucide-react";

interface CustomerOrderSuccessProps {
  orderId: string;
  orderNumber: string;
  orderType: "outlet_pickup" | "outlet_delivery";
  outletName?: string;
  outletAddress?: string;
  deliveryAddress?: string;
  estimatedTime: string;
  onNavigate: (view: string, orderId?: string) => void;
}

export default function CustomerOrderSuccess({
  orderId,
  orderNumber,
  orderType,
  outletName,
  outletAddress,
  deliveryAddress,
  estimatedTime,
  onNavigate,
}: CustomerOrderSuccessProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background dark:from-green-950/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Success Icon */}
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
            <div className="relative bg-green-500 rounded-full p-6">
              <CheckCircle className="h-16 w-16 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-green-700 dark:text-green-400 mb-2">
              Pesanan Berhasil!
            </h1>
            <p className="text-muted-foreground">Terima kasih atas pesanan Anda</p>
          </div>
        </div>

        {/* Order Details Card */}
        <Card className="p-6 space-y-4">
          {/* Order Number */}
          <div className="text-center pb-4 border-b">
            <p className="text-sm text-muted-foreground mb-1">Nomor Pesanan</p>
            <p className="text-2xl font-bold tracking-wider">{orderNumber}</p>
          </div>

          {/* Order Type Badge */}
          <div className="flex justify-center">
            {orderType === "outlet_pickup" ? (
              <Badge className="px-4 py-2 text-base">
                <MapPin className="h-4 w-4 mr-2" />
                Pickup di Outlet
              </Badge>
            ) : (
              <Badge className="px-4 py-2 text-base" variant="secondary">
                <Truck className="h-4 w-4 mr-2" />
                Delivery
              </Badge>
            )}
          </div>

          {/* Location Info */}
          <div className="space-y-3">
            {orderType === "outlet_pickup" && outletName && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-semibold mb-1">{outletName}</p>
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{outletAddress}</span>
                </p>
              </div>
            )}

            {orderType === "outlet_delivery" && deliveryAddress && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-semibold mb-1">Alamat Pengiriman</p>
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{deliveryAddress}</span>
                </p>
              </div>
            )}

            {/* Estimated Time */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="bg-primary rounded-full p-2">
                  <Clock className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-primary">Estimasi Waktu</p>
                  <p className="text-sm text-muted-foreground">{estimatedTime}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 justify-center">
              <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                Pesanan sedang disiapkan
              </p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full h-12"
            onClick={() => onNavigate("order-detail", orderId)}
          >
            <FileText className="h-5 w-5 mr-2" />
            Lihat Detail Pesanan
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            className="w-full h-12"
            onClick={() => onNavigate("home")}
          >
            <Home className="h-5 w-5 mr-2" />
            Kembali ke Home
          </Button>
        </div>

        {/* Info Text */}
        <p className="text-center text-sm text-muted-foreground px-4">
          Anda dapat melacak status pesanan di halaman "Pesanan Saya"
        </p>
      </div>
    </div>
  );
}
