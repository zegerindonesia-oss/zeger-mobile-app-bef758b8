import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZegerLogo } from '@/components/ui/zeger-logo';
import { 
  Home, 
  Ticket, 
  ClipboardList, 
  User,
  MapPin,
  ShoppingCart,
  Star,
  Gift,
  Plus,
  Minus,
  Phone,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomerAuth } from '@/components/customer/CustomerAuth';
import { CustomerHome } from '@/components/customer/CustomerHome';
import { CustomerVouchers } from '@/components/customer/CustomerVouchers';
import { CustomerOrders } from '@/components/customer/CustomerOrders';
import { CustomerProfile } from '@/components/customer/CustomerProfile';
import CustomerMap from '@/components/customer/CustomerMap';
import { CustomerMenu } from '@/components/customer/CustomerMenu';
import { CustomerCartNew } from '@/components/customer/CustomerCartNew';
import { CustomerProductDetail } from '@/components/customer/CustomerProductDetail';
import { BottomNavigation } from '@/components/customer/BottomNavigation';
import { CustomerOutletList } from '@/components/customer/CustomerOutletList';
import { OrderDetail } from '@/components/customer/OrderDetail';
import CustomerCheckout from '@/components/customer/CustomerCheckout';
import CustomerOrderSuccess from '@/components/customer/CustomerOrderSuccess';
import CustomerOrderWaiting from '@/components/customer/CustomerOrderWaiting';
import CustomerOrderTracking from '@/components/customer/CustomerOrderTracking';
import CustomerPaymentMethod from '@/components/customer/CustomerPaymentMethod';
import { useToast } from '@/hooks/use-toast';

interface CustomerUser {
  id: string;
  name?: string;
  full_name?: string;
  email: string;
  phone: string;
  points: number;
  address: string;
  photo_url?: string;
  membership_level?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  custom_options: any;
}

interface CartItem extends Product {
  quantity: number;
  customizations: any;
}

type View = 'home' | 'vouchers' | 'orders' | 'profile' | 'map' | 'menu' | 'product-detail' | 'cart' | 'outlets' | 'checkout' | 'payment' | 'order-success' | 'waiting' | 'order-tracking';

export default function CustomerApp() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  
  // App state
  const [activeView, setActiveView] = useState<View>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  
  // Outlet selection state
  const [selectedOutlet, setSelectedOutlet] = useState<{
    id: string;
    name: string;
    address: string;
  } | null>(null);
  
  // Order success state
  const [lastOrderId, setLastOrderId] = useState<string>('');
  const [lastOrderNumber, setLastOrderNumber] = useState<string>('');
  const [lastOrderType, setLastOrderType] = useState<'outlet_pickup' | 'outlet_delivery'>('outlet_pickup');
  const [estimatedTime, setEstimatedTime] = useState<string>('15-30 menit');
  
  // Waiting state for rider requests
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingRider, setPendingRider] = useState<any>(null);
  
  // Track order state
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackingRider, setTrackingRider] = useState<any>(null);
  const [trackingCoordinates, setTrackingCoordinates] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  
  // Product detail state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Pending order data for payment flow
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);
  
  // Handle query params for order detail
  const tab = searchParams.get('tab');
  const orderId = searchParams.get('id');

  // Check authentication and fetch customer profile
  useEffect(() => {
    if (user) {
      fetchCustomerProfile();
    } else {
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, [user]);

  // Restore pending order from localStorage on mount
  useEffect(() => {
    if (!customerUser) return;

    const restorePendingOrder = async () => {
      const savedOrderId = localStorage.getItem('zeger-last-pending-order');
      if (!savedOrderId) return;

      try {
        const { data: orderData, error } = await supabase
          .from('customer_orders')
          .select(`
            *,
            rider:rider_profile_id (
              id,
              full_name,
              phone,
              photo_url
            )
          `)
          .eq('id', savedOrderId)
          .single();

        if (error) {
          localStorage.removeItem('zeger-last-pending-order');
          return;
        }

        if (orderData) {
          if (orderData.status === 'accepted' || orderData.status === 'on_the_way') {
            // Redirect to tracking
            setTrackingOrderId(savedOrderId);
            setTrackingRider(orderData.rider);
            setTrackingCoordinates({
              lat: orderData.latitude || 0,
              lng: orderData.longitude || 0,
              address: orderData.delivery_address || ''
            });
            setActiveView('order-tracking');
          } else if (orderData.status === 'pending') {
            // Redirect to waiting screen
            setPendingOrderId(savedOrderId);
            setPendingRider(orderData.rider);
            setActiveView('waiting');
          } else {
            // Order completed or cancelled, clear localStorage
            localStorage.removeItem('zeger-last-pending-order');
          }
        }
      } catch (error) {
        console.error('Error restoring pending order:', error);
        localStorage.removeItem('zeger-last-pending-order');
      }
    };

    restorePendingOrder();
  }, [customerUser]);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Real-time subscription for active orders
  useEffect(() => {
    if (!customerUser?.id) return;

    const fetchActiveOrdersCount = async () => {
      const { count } = await supabase
        .from('customer_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', customerUser.id)
        .in('status', ['pending', 'accepted', 'on_the_way']);
      
      setActiveOrdersCount(count || 0);
    };

    fetchActiveOrdersCount();

    // Subscribe to order changes
    const channel = supabase
      .channel('customer_active_orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders',
          filter: `user_id=eq.${customerUser.id}`
        },
        (payload) => {
          console.log('Order update:', payload);
          fetchActiveOrdersCount();
          
          // Show toast notifications for status changes
          if (payload.eventType === 'UPDATE') {
            const newStatus = (payload.new as any)?.status;
            const oldStatus = (payload.old as any)?.status;
            
            if (newStatus !== oldStatus) {
              // Play notification sound
              const audio = new Audio('/notification.mp3');
              audio.play().catch(err => console.log('Audio failed:', err));
              
              // Show toast based on status
              if (newStatus === 'accepted') {
                toast({
                  title: "✅ Pesanan Diterima!",
                  description: "Rider telah menerima pesanan Anda",
                });
                
                // Auto-redirect to tracking if it's the last pending order
                const savedOrderId = localStorage.getItem('zeger-last-pending-order');
                if (savedOrderId === (payload.new as any).id) {
                  fetchOrderForTracking(savedOrderId);
                }
              } else if (newStatus === 'on_the_way') {
                toast({
                  title: "🚗 Rider Dalam Perjalanan!",
                  description: "Pesanan Anda sedang diantar",
                });
              } else if (newStatus === 'delivered') {
                toast({
                  title: "🎉 Pesanan Tiba!",
                  description: "Selamat menikmati kopi Zeger!",
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerUser, toast]);

  // Subscribe to order status changes for auto-redirect to success screen
  useEffect(() => {
    if (!pendingOrderId) return;

    const channel = supabase
      .channel('order_status_subscription')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${pendingOrderId}`
      }, async (payload) => {
        const newStatus = payload.new.status;
        
        if (newStatus === 'accepted') {
          console.log('✅ Order accepted! Redirecting to success screen...');
          
          // Fetch order details
          const { data: orderData } = await supabase
            .from('customer_orders')
            .select('*')
            .eq('id', pendingOrderId)
            .single();

          if (orderData) {
            // Set success screen data
            setLastOrderId(pendingOrderId);
            setLastOrderNumber(pendingOrderId.slice(0, 8).toUpperCase());
            setLastOrderType('outlet_delivery');
            setEstimatedTime('15-30 menit');
            
            // Navigate to success screen
            setActiveView('order-success');
            setPendingOrderId(null);
            setPendingRider(null);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingOrderId]);

  const fetchOrderForTracking = async (orderId: string) => {
    try {
      const { data: orderData, error } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('Error fetching order:', error);
        return;
      }

      if (orderData) {
        // Create rider object from order data
        const riderInfo = {
          id: orderData.rider_profile_id || '',
          full_name: 'Rider Zeger',
          phone: '-',
          photo_url: null,
          rating: 4.5
        };

        setTrackingOrderId(orderId);
        setTrackingRider(riderInfo);
        setTrackingCoordinates({
          lat: orderData.latitude || 0,
          lng: orderData.longitude || 0,
          address: orderData.delivery_address || ''
        });
        setActiveView('order-tracking');
      }
    } catch (error) {
      console.error('Error in fetchOrderForTracking:', error);
    }
  };

  const fetchCustomerProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_users')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // No profile exists, user needs to complete registration
        setIsAuthenticated(false);
      } else if (error) {
        throw error;
      } else {
        setCustomerUser(data);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error fetching customer profile:', error);
      toast({
        title: "Error",
        description: "Gagal memuat profil customer",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addToCart = (product: Product, quantity: number = 1, customizations: any = {}) => {
    console.log('🛒 Adding to cart:', {
      productId: product.id,
      name: product.name,
      basePrice: product.price,
      quantity,
      customizations
    });

    const cartKey = `${product.id}-${JSON.stringify(customizations)}`;
    const existingItem = cart.find(item => 
      `${item.id}-${JSON.stringify(item.customizations)}` === cartKey
    );

    if (existingItem) {
      setCart(cart.map(item =>
        `${item.id}-${JSON.stringify(item.customizations)}` === cartKey
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity, customizations }]);
    }

    console.log('💰 Cart updated. New cart:', cart);

    toast({
      title: "Ditambahkan ke keranjang",
      description: `${product.name} berhasil ditambahkan`,
    });
    
    // Navigate back to menu
    setSelectedProduct(null);
    setActiveView('menu');
  };

  const updateCartQuantity = (productId: string, customizations: any, newQuantity: number) => {
    const cartKey = `${productId}-${JSON.stringify(customizations)}`;
    
    if (newQuantity <= 0) {
      setCart(cart.filter(item => 
        `${item.id}-${JSON.stringify(item.customizations)}` !== cartKey
      ));
      toast({
        title: "Item dihapus",
        description: "Item telah dihapus dari keranjang",
      });
    } else {
      setCart(cart.map(item =>
        `${item.id}-${JSON.stringify(item.customizations)}` === cartKey
          ? { ...item, quantity: newQuantity }
          : item
      ));
    }
  };

  const handleEditCartItem = (item: CartItem) => {
    const product = products.find(p => p.id === item.id);
    if (!product) return;
    
    setSelectedProduct(product);
    setActiveView('product-detail');
  };

  const handleDeleteCartItem = (item: CartItem) => {
    if (confirm(`Hapus ${item.name} dari keranjang?`)) {
      setCart(prevCart => 
        prevCart.filter(cartItem => 
          !(cartItem.id === item.id && 
            JSON.stringify(cartItem.customizations) === JSON.stringify(item.customizations))
        )
      );
      
      toast({
        title: "Item dihapus",
        description: `${item.name} telah dihapus dari keranjang`,
      });
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleProceedToPayment = (orderData: any) => {
    // Save order data and navigate to payment selection
    setPendingOrderData(orderData);
    setActiveView('payment');
  };

  const handleConfirmOrder = async (paymentMethodOrString?: string) => {
    if (!pendingOrderData) return;
    
    const paymentMethod = (paymentMethodOrString || 'e_wallet') as 'cash' | 'e_wallet' | 'qris';
    
    try {
      const orderData = {
        ...pendingOrderData,
        paymentMethod
      };

      // 1. Insert customer_order
      const { data: order, error: orderError } = await supabase
        .from('customer_orders')
        .insert({
          user_id: customerUser!.id,
          outlet_id: orderData.outletId,
          order_type: orderData.orderType,
          delivery_address: orderData.deliveryAddress,
          latitude: orderData.deliveryLat,
          longitude: orderData.deliveryLng,
          payment_method: paymentMethod,
          voucher_id: orderData.voucherId,
          total_price: orderData.totalPrice,
          delivery_fee: orderData.deliveryFee,
          discount_amount: orderData.discount,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert customer_order_items
      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        custom_options: item.customizations
      }));

      const { error: itemsError } = await supabase
        .from('customer_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Update customer points (deduct used points, earned points added by trigger)
      const newPointsBalance = (customerUser!.points || 0) - (orderData.pointsUsed || 0);
      const { error: pointsError } = await supabase
        .from('customer_users')
        .update({ points: newPointsBalance })
        .eq('id', customerUser!.id);

      if (pointsError) throw pointsError;
      
      // Update local state
      setCustomerUser(prev => prev ? {...prev, points: newPointsBalance} : null);

      // 4. Clear cart and pending order data
      setCart([]);
      setPendingOrderData(null);

      // 5. Navigate to success page
      setLastOrderId(order.id);
      setLastOrderNumber(order.id.slice(0, 8).toUpperCase());
      setLastOrderType(orderData.orderType);
      setEstimatedTime(
        orderData.orderType === 'outlet_pickup' 
          ? '15-30 menit' 
          : '~45 menit'
      );
      setActiveView('order-success');

      toast({
        title: "✅ Pesanan Berhasil!",
        description: "Pesanan Anda sedang diproses",
      });

    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Error",
        description: "Gagal membuat pesanan. Silakan coba lagi.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <ZegerLogo size="lg" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <CustomerAuth onAuthSuccess={() => {
      setIsAuthenticated(true);
      fetchCustomerProfile();
    }} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className={cn("pb-20", activeView === 'home' && "pt-0")}>
        {tab === 'order-detail' && orderId ? (
          <OrderDetail 
            orderId={orderId} 
            userRole="customer"
            onBack={() => {
              setSearchParams({});
              setActiveView('orders');
            }}
          />
        ) : (
          <>
            {activeView === 'home' && (
              <CustomerHome 
                customerUser={customerUser} 
                onNavigate={setActiveView}
                recentProducts={products.slice(0, 6)}
                onAddToCart={addToCart}
              />
            )}
            {activeView === 'vouchers' && <CustomerVouchers customerUser={customerUser} />}
            {activeView === 'orders' && <CustomerOrders customerUser={customerUser} />}
            {activeView === 'profile' && <CustomerProfile customerUser={customerUser} onUpdateProfile={() => fetchCustomerProfile()} />}
            {activeView === 'map' && (
              <CustomerMap 
                customerUser={customerUser}
                onCallRider={(orderId, rider) => {
                  setPendingOrderId(orderId);
                  setPendingRider(rider);
                  localStorage.setItem('zeger-last-pending-order', orderId);
                  setActiveView('waiting');
                }}
              />
            )}
            {activeView === 'outlets' && (
              <CustomerOutletList 
                onNavigate={(view: string) => setActiveView(view as View)}
                onSelectOutlet={(outlet: any) => {
                  setSelectedOutlet({
                    id: outlet.id,
                    name: outlet.name,
                    address: outlet.address
                  });
                  setActiveView('menu');
                }}
              />
            )}
            {activeView === 'menu' && (
              <CustomerMenu 
                products={products}
                onAddToCart={(product) => {
                  setSelectedProduct(product);
                  setActiveView('product-detail');
                }}
                outletId={selectedOutlet?.id}
                outletName={selectedOutlet?.name}
                outletAddress={selectedOutlet?.address}
                onChangeOutlet={() => setActiveView('outlets')}
                cartItemCount={cart.length}
                onViewCart={() => setActiveView('cart')}
              />
            )}
            {activeView === 'product-detail' && selectedProduct && (
              <CustomerProductDetail
                product={selectedProduct}
                orderType="take-away"
                onBack={() => {
                  setSelectedProduct(null);
                  setActiveView('menu');
                }}
                onAddToCart={addToCart}
                cartItemCount={cart.length}
                onViewCart={() => {
                  setSelectedProduct(null);
                  setActiveView('cart');
                }}
              />
            )}
            {activeView === 'cart' && (
              <CustomerCartNew
                cart={cart}
                outletName={selectedOutlet?.name}
                outletAddress={selectedOutlet?.address}
                outletDistance="0.01 km"
                onUpdateQuantity={updateCartQuantity}
                onNavigate={(view: string) => {
                  if (view === 'checkout' && !selectedOutlet) {
                    setActiveView('outlets');
                    toast({
                      title: "Pilih Outlet",
                      description: "Silakan pilih outlet terlebih dahulu",
                    });
                  } else {
                    setActiveView(view as View);
                  }
                }}
                onChangeOutlet={() => setActiveView('outlets')}
                onAddMenu={() => setActiveView('menu')}
                onEditItem={handleEditCartItem}
                onDeleteItem={handleDeleteCartItem}
              />
            )}
            {activeView === 'checkout' && selectedOutlet && customerUser && (
              <CustomerCheckout
                cart={cart}
                outletId={selectedOutlet.id}
                outletName={selectedOutlet.name}
                outletAddress={selectedOutlet.address}
                customerUser={customerUser}
                onConfirm={handleProceedToPayment}
                onBack={() => setActiveView('cart')}
              />
            )}
            {activeView === 'payment' && pendingOrderData && (
              <CustomerPaymentMethod
                orderId=""
                totalAmount={pendingOrderData.totalPrice}
                orderType={pendingOrderData.orderType}
                onBack={() => setActiveView('checkout')}
                onSuccess={handleConfirmOrder}
              />
            )}
            {activeView === 'order-success' && lastOrderId && (
              <CustomerOrderSuccess
                orderId={lastOrderId}
                orderNumber={lastOrderNumber}
                orderType={lastOrderType}
                outletName={selectedOutlet?.name}
                outletAddress={selectedOutlet?.address}
                estimatedTime={estimatedTime}
                onNavigate={(view: string, id?: string) => {
                  if (view === 'order-tracking' && id) {
                    fetchOrderForTracking(id);
                  } else if (id) {
                    setSearchParams({ tab: 'order-detail', id });
                  } else {
                    setActiveView(view as View);
                  }
                }}
              />
            )}
            {activeView === 'waiting' && pendingOrderId && pendingRider && (
              <CustomerOrderWaiting
                orderId={pendingOrderId}
                rider={pendingRider}
                onAccepted={() => {
                  setActiveView('orders');
                  setPendingOrderId(null);
                  setPendingRider(null);
                  toast({
                    title: "✅ Rider Menerima!",
                    description: "Cek tab Pesanan untuk tracking",
                  });
                }}
                onRejected={(reason) => {
                  setActiveView('map');
                  setPendingOrderId(null);
                  setPendingRider(null);
                  toast({
                    title: "❌ Rider Menolak",
                    description: reason,
                    variant: "destructive"
                  });
                }}
                onCancel={async () => {
                  if (pendingOrderId) {
                    await supabase
                      .from('customer_orders')
                      .update({ status: 'cancelled' })
                      .eq('id', pendingOrderId);
                  }
                  setActiveView('map');
                  setPendingOrderId(null);
                  setPendingRider(null);
                  toast({
                    title: "Dibatalkan",
                    description: "Permintaan dibatalkan",
                  });
                }}
              />
            )}
            {activeView === 'order-tracking' && trackingOrderId && trackingCoordinates && (
              <CustomerOrderTracking
                orderId={trackingOrderId}
                rider={trackingRider || { id: '', full_name: 'Rider', phone: '-' }}
                customerLat={trackingCoordinates.lat}
                customerLng={trackingCoordinates.lng}
                deliveryAddress={trackingCoordinates.address}
                onCompleted={() => {
                  toast({
                    title: "Pesanan Selesai!",
                    description: "Terima kasih telah menggunakan Zeger",
                  });
                  setActiveView('orders');
                  setTrackingOrderId(null);
                  setTrackingRider(null);
                  setTrackingCoordinates(null);
                  localStorage.removeItem('zeger-last-pending-order');
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      {!['waiting', 'order-success'].includes(activeView) && tab !== 'order-detail' && (
        <BottomNavigation
          activeView={activeView}
          activeOrdersCount={activeOrdersCount}
          onNavigate={(view) => setActiveView(view as View)}
        />
      )}
    </div>
  );
}