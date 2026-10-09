import React from 'react';
import { ChevronLeft, MapPin, Plus, Minus, ShoppingBag, Pencil, Trash2, Store, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cxArt, artworkFor, onArtError, formatRupiah } from '@/lib/customer-art';
import { unitPrice, cartSubtotal, cartItemCount, describeCustomizations, pointsFor } from '@/lib/customer-pricing';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  category?: string;
  customizations: Record<string, any>;
}

export type CustomerOrderMode = 'outlet_pickup' | 'outlet_delivery';

interface CustomerCartNewProps {
  cart: CartItem[];
  outletName?: string;
  outletAddress?: string;
  outletDistance?: string;
  orderMode?: CustomerOrderMode;
  onOrderModeChange?: (mode: CustomerOrderMode) => void;
  onUpdateQuantity: (productId: string, customizations: any, newQuantity: number) => void;
  onNavigate: (view: string) => void;
  onChangeOutlet: () => void;
  onAddMenu: () => void;
  onEditItem?: (item: CartItem) => void;
  onDeleteItem?: (item: CartItem) => void;
}

export function CustomerCartNew({
  cart,
  outletName,
  outletAddress,
  outletDistance,
  orderMode = 'outlet_pickup',
  onOrderModeChange,
  onUpdateQuantity,
  onNavigate,
  onChangeOutlet,
  onAddMenu,
  onEditItem,
  onDeleteItem,
}: CustomerCartNewProps) {
  const subtotal = cartSubtotal(cart as any);
  const totalItems = cartItemCount(cart as any);

  if (cart.length === 0) {
    return (
      <div className="cx-app min-h-screen flex flex-col">
        <header className="cx-bar sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
          <button onClick={() => onNavigate('home')} className="cx-icon-btn h-10 w-10" aria-label="Kembali">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Keranjang</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="cx-stage h-40 w-40 rounded-[2rem] flex items-center justify-center mb-6">
            <img src={cxArt.bag} alt="" className="cx-art cx-float h-28 w-28 object-contain" />
          </div>
          <h2 className="text-xl font-bold mb-1">Keranjang masih kosong</h2>
          <p className="text-sm text-muted-foreground mb-6">Yuk pilih minuman favoritmu dulu.</p>
          <button onClick={onAddMenu} className="cx-btn cx-btn-primary px-8 py-3.5 text-sm">
            Lihat Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cx-app min-h-screen pb-44">
      {/* Header */}
      <header className="cx-bar sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
        <button onClick={() => onNavigate('menu')} className="cx-icon-btn h-10 w-10" aria-label="Kembali">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Detail Pesanan</h1>
          <p className="text-xs text-muted-foreground">{totalItems} item</p>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Pickup / Delivery */}
        <div className="cx-seg grid grid-cols-2 gap-1 cx-rise">
          <button
            type="button"
            data-active={orderMode === 'outlet_pickup'}
            onClick={() => onOrderModeChange?.('outlet_pickup')}
            className="cx-seg-item flex items-center justify-center gap-2 py-2.5 text-sm"
          >
            <ShoppingBag className="h-4 w-4" /> Ambil Sendiri
          </button>
          <button
            type="button"
            data-active={orderMode === 'outlet_delivery'}
            onClick={() => onOrderModeChange?.('outlet_delivery')}
            className="cx-seg-item flex items-center justify-center gap-2 py-2.5 text-sm"
          >
            <Bike className="h-4 w-4" /> Diantar
          </button>
        </div>

        {/* Outlet */}
        {outletName && (
          <div className="cx-card rounded-3xl p-4 cx-rise">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-zeger-soft flex items-center justify-center shrink-0">
                <Store className="h-5 w-5 text-zeger" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{outletName}</p>
                {outletAddress && <p className="text-xs text-muted-foreground line-clamp-2">{outletAddress}</p>}
                {outletDistance && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-zeger">
                    <MapPin className="h-3 w-3" /> {outletDistance}
                  </p>
                )}
              </div>
              <button onClick={onChangeOutlet} className="cx-btn cx-btn-ghost px-4 py-2 text-xs shrink-0">
                Ubah
              </button>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-base font-bold">Daftar Pesanan</h2>
          <button onClick={onAddMenu} className="cx-btn cx-btn-ghost px-4 py-2 text-xs inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Tambah Menu
          </button>
        </div>

        <div className="space-y-3">
          {cart.map((item, idx) => {
            const perUnit = unitPrice(item as any);
            const detail = describeCustomizations(item.customizations);
            return (
              <div
                key={`${item.id}-${idx}`}
                className="cx-card rounded-3xl p-3 cx-rise"
                style={{ animationDelay: `${Math.min(idx, 6) * 40}ms` }}
              >
                <div className="flex gap-3">
                  <div className="cx-stage h-20 w-20 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={item.image_url || artworkFor(item)}
                      alt={item.name}
                      onError={onArtError(artworkFor(item))}
                      className={cn('object-cover h-full w-full', !item.image_url && 'cx-art object-contain p-1.5')}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-sm leading-snug line-clamp-2">{item.name}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {onEditItem && (
                          <button onClick={() => onEditItem(item)} className="cx-icon-btn h-7 w-7" aria-label="Ubah">
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                        {onDeleteItem && (
                          <button onClick={() => onDeleteItem(item)} className="cx-icon-btn h-7 w-7" aria-label="Hapus">
                            <Trash2 className="h-3 w-3 text-zeger" />
                          </button>
                        )}
                      </div>
                    </div>
                    {detail && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{detail}</p>}
                    <div className="flex items-end justify-between mt-2.5">
                      <p className="cx-num text-sm font-extrabold text-zeger">{formatRupiah(perUnit * item.quantity)}</p>
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.customizations, item.quantity - 1)}
                          className="cx-icon-btn h-8 w-8"
                          aria-label="Kurangi"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="cx-num text-sm font-bold w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.customizations, item.quantity + 1)}
                          className="cx-icon-btn h-8 w-8"
                          aria-label="Tambah"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Points preview */}
        <div className="cx-card rounded-3xl p-4 flex items-center gap-3">
          <img src={cxArt.coin} alt="" className="cx-coin cx-coin-spin h-9 w-9 object-contain" />
          <div className="flex-1">
            <p className="text-sm font-bold">Dapat {pointsFor(subtotal)} Zeger Point</p>
            <p className="text-[11px] text-muted-foreground">Berlaku di semua channel Zeger.</p>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 bg-gradient-to-t from-[hsl(var(--cx-canvas))] via-[hsl(var(--cx-canvas))] to-transparent">
        <div className="mx-auto max-w-md">
          <p className="text-[10px] text-center text-muted-foreground mb-2">
            Dengan melanjutkan, kamu menyetujui Syarat &amp; Ketentuan Zeger.
          </p>
          <button
            onClick={() => onNavigate('checkout')}
            className="cx-btn cx-btn-primary w-full px-5 py-4 flex items-center justify-between"
          >
            <span className="text-sm">Lanjut Pembayaran</span>
            <span className="cx-num text-base font-extrabold">{formatRupiah(subtotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerCartNew;
