import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Package, Clock, DollarSign, TrendingUp,
  MapPin, Users, Activity, Navigation, RefreshCw, Phone, BarChart3, Volume2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MobileIncomingOrder } from './MobileIncomingOrder';
import { unlockAudio, playAlertBeep, ensureUnlockListeners } from '@/lib/audio';

interface DashboardStats {
  totalStock: number;
  todaySales: number;
  todayTransactions: number;
  activeCustomers: number;
}

interface RiderProfile {
  id: string;
  full_name: string;
}

const MobileRiderDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStock: 0,
    todaySales: 0,
    todayTransactions: 0,
    activeCustomers: 0
  });
  const [chartData, setChartData] = useState<{date: string, sales: number}[]>([]);
  const [topProducts, setTopProducts] = useState<{name: string, quantity: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<'active' | 'inactive' | 'error'>('inactive');
  const [lastGpsUpdate, setLastGpsUpdate] = useState<Date | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [riderProfile, setRiderProfile] = useState<RiderProfile | null>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showSoundBanner, setShowSoundBanner] = useState(false);

  const fetchRiderProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('user_id', user?.id)
        .single();
      
      if (data) {
        setRiderProfile(data);
      }
    } catch (error) {
      console.error('Error fetching rider profile:', error);
    }
  };

  useEffect(() => {
    if (!user) {
      return () => {}; // ✅ Always return cleanup, even if empty
    }

    // Check if sound needs to be enabled
    if (window.AudioContext && !localStorage.getItem('zeger-sound-enabled')) {
      setShowSoundBanner(true);
    }
    
    // Ensure unlock listeners are set
    ensureUnlockListeners();

    fetchRiderProfile();
    fetchDashboardData();
    checkActiveShift();
    startLocationTracking();
    fetchPendingOrders();
    
    // Subscribe to pending orders
    const channel = supabase
      .channel('pending_orders_count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_orders'
        },
        () => {
          fetchPendingOrders();
        }
      )
      .subscribe();

    // Phase 2: Subscribe to incoming customer orders (new orders assigned to this rider)
    const fetchProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      
      if (profile) {
        console.log('🔍 Subscribing to orders for rider_profile_id:', profile.id);
        
        const ordersChannel = supabase
          .channel('incoming_customer_orders')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'customer_orders',
              filter: `rider_profile_id=eq.${profile.id}`
            },
            async (payload) => {
              console.log('📦 Raw order received:', payload.new);
              
              // Fetch complete order with relations
              const { data: fullOrder, error } = await supabase
                .from('customer_orders')
                .select(`
                  *,
                  customer_users!customer_orders_user_id_fkey(name, phone),
                  customer_order_items(
                    id,
                    product_id,
                    quantity,
                    price,
                    products(name, code)
                  )
                `)
                .eq('id', payload.new.id)
                .single();

              if (error) {
                console.error('❌ Error fetching full order:', error);
                toast.error('Gagal memuat detail pesanan');
                return;
              }

              console.log('✅ Full order data:', fullOrder);

              // Show notification
              toast.success('Pesanan Baru Masuk!', {
                description: `Order dari ${fullOrder.customer_users.name}`,
                duration: 10000,
              });

              // Play notification sound & vibrate
              playAlertBeep({ times: 5, freq: 1200, durationMs: 600, volume: 0.9, intervalMs: 800 });

              // Set order and show popup
              setCurrentOrder(fullOrder);
              setShowOrderDialog(true);
              
              // Refresh pending orders count
              fetchPendingOrders();
            }
          )
          .subscribe();
      }
    };

    fetchProfile();

    return () => {
      stopLocationTracking();
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Request GPS permission on mount
  useEffect(() => {
    const requestGPSPermission = async () => {
      if (!navigator.geolocation) {
        toast.error('Perangkat Anda tidak mendukung GPS');
        setGpsStatus('error');
        return;
      }

      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        
        if (result.state === 'denied') {
          toast.error('GPS diblokir. Silakan aktifkan GPS di pengaturan browser');
          setGpsStatus('error');
        } else {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setRiderLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
              setGpsStatus('active');
              toast.success('GPS aktif');
            },
            (error) => {
              console.error('GPS error:', error);
              toast.error('Tidak dapat mengakses GPS');
              setGpsStatus('error');
            },
            { enableHighAccuracy: true }
          );
        }
      } catch (err) {
        // Browser doesn't support permissions API, request directly
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setRiderLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setGpsStatus('active');
          },
          (error) => {
            console.error('GPS error:', error);
            toast.error('Tidak dapat mengakses GPS');
            setGpsStatus('error');
          }
        );
      }
    };

    requestGPSPermission();
  }, []);

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      setGpsStatus('error');
      toast.error('GPS tidak didukung di perangkat ini');
      return;
    }

    setGpsStatus('active');

    // Initial location update
    updateLocation();

    // Watch position for real-time updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        updateLocationToServer(position.coords);
        setGpsStatus('active');
        setLastGpsUpdate(new Date());
      },
      (error) => {
        console.error('Error watching position:', error);
        setGpsStatus('error');
        
        let errorMessage = 'Gagal mengakses GPS';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Izin GPS ditolak. Aktifkan di pengaturan.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Lokasi tidak tersedia.';
            break;
          case error.TIMEOUT:
            errorMessage = 'GPS timeout.';
            break;
        }
        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000
      }
    );

    // Periodic update every 30 seconds
    locationIntervalRef.current = setInterval(() => {
      updateLocation();
    }, 30000);
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
  };

  const updateLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocationToServer(position.coords);
      },
      (error) => {
        console.error('Error getting location:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  const updateLocationToServer = async (coords: GeolocationCoordinates) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      const { error } = await supabase.functions.invoke('update-rider-location-live', {
        body: {
          rider_profile_id: profile.id,
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          heading: coords.heading,
          speed: coords.speed
        }
      });

      if (error) {
        console.error('Error updating location:', error);
        setGpsStatus('error');
      } else {
        setGpsStatus('active');
        setLastGpsUpdate(new Date());
      }
    } catch (error) {
      console.error('Error in updateLocationToServer:', error);
      setGpsStatus('error');
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch rider profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        toast.error('Gagal memuat data profil.');
        return;
      }

      const riderId = profile?.id;

      // Fetch total stock
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('stock_quantity')
        .eq('rider_id', riderId);

      if (inventoryError) {
        console.error('Error fetching inventory:', inventoryError);
        toast.error('Gagal memuat data inventori.');
        return;
      }

      const totalStock = inventoryData?.reduce((sum, item) => sum + (item.stock_quantity || 0), 0) || 0;

      // Fetch today's sales
      const today = new Date().toISOString().split('T')[0];
      const { data: salesData, error: salesError } = await supabase
        .from('transactions')
        .select('final_amount, transaction_date')
        .eq('rider_id', riderId)
        .gte('transaction_date', `${today}T00:00:00`)
        .lte('transaction_date', `${today}T23:59:59`);

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        toast.error('Gagal memuat data penjualan.');
        return;
      }

      const todaySales = salesData?.reduce((sum, order) => sum + (Number(order.final_amount) || 0), 0) || 0;
      const todayTransactions = salesData?.length || 0;

      // Fetch 7 days transaction data for chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: weekData } = await supabase
        .from('transactions')
        .select('id, final_amount, transaction_date')
        .eq('rider_id', riderId)
        .gte('transaction_date', sevenDaysAgo.toISOString())
        .order('transaction_date', { ascending: true });

      // Group by date for chart
      const chartDataMap: Record<string, number> = {};
      weekData?.forEach(tx => {
        const date = new Date(tx.transaction_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
        chartDataMap[date] = (chartDataMap[date] || 0) + Number(tx.final_amount);
      });
      setChartData(Object.entries(chartDataMap).map(([date, sales]) => ({ date, sales })));

      // Fetch top products from transaction items
      const transactionIds = weekData?.map(tx => tx.id) || [];
      if (transactionIds.length > 0) {
        const { data: topProductsData } = await supabase
          .from('transaction_items')
          .select(`
            quantity,
            products(name)
          `)
          .in('transaction_id', transactionIds);

        // Aggregate top products
        const productMap: Record<string, number> = {};
        topProductsData?.forEach((item: any) => {
          const name = item.products?.name || 'Unknown';
          productMap[name] = (productMap[name] || 0) + item.quantity;
        });
        const sortedProducts = Object.entries(productMap)
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);
        setTopProducts(sortedProducts);
      }

      // TODO: Implement active customers logic
      const activeCustomers = 5;

      setStats({
        totalStock,
        todaySales,
        todayTransactions,
        activeCustomers
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingOrders = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      console.log('🔍 Fetching pending orders count for rider_profile_id:', profile.id);
      
      const { count, error } = await supabase
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('rider_profile_id', profile.id)
        .eq('status', 'pending');
      
      console.log('📊 Pending orders count:', count);

      if (error) {
        console.error('Error fetching pending orders:', error);
        return;
      }

      setPendingOrdersCount(count || 0);
    } catch (error) {
      console.error('Error in fetchPendingOrders:', error);
    }
  };

  const checkActiveShift = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      const { data: shifts, error: shiftsError } = await supabase
        .from('shift_management')
        .select('*')
        .eq('rider_id', profile.id)
        .eq('shift_date', today)
        .eq('status', 'active')
        .is('shift_end_time', null);

      if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError);
        toast.error('Failed to check active shift.');
        return;
      }

      setHasActiveShift(shifts && shifts.length > 0);
    } catch (error) {
      console.error('Error checking active shift:', error);
      toast.error('Failed to check active shift.');
    }
  };

  const handleShiftStart = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, branch_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      const { error } = await supabase
        .from('shift_management')
        .insert([
          {
            rider_id: profile.id,
            branch_id: profile.branch_id!,
            shift_date: today,
            shift_start_time: new Date().toISOString(),
            status: 'active'
          }
        ]);

      if (error) {
        console.error('Error starting shift:', error);
        toast.error('Failed to start shift.');
        return;
      }

      setHasActiveShift(true);
      toast.success('Shift started successfully!');
    } catch (error) {
      console.error('Error starting shift:', error);
      toast.error('Failed to start shift.');
    }
  };

  const handleShiftEnd = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      const { error } = await supabase
        .from('shift_management')
        .update({
          status: 'completed',
          shift_end_time: new Date().toISOString()
        })
        .eq('rider_id', profile.id)
        .eq('shift_date', today)
        .eq('status', 'active');

      if (error) {
        console.error('Error ending shift:', error);
        toast.error('Failed to end shift.');
        return;
      }

      setHasActiveShift(false);
      toast.success('Shift ended successfully!');
    } catch (error) {
      console.error('Error ending shift:', error);
      toast.error('Failed to end shift.');
    }
  };

  const playEnhancedNotification = () => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Play 3 beeps
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.5;
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
        }, i * 700);
      }
      
      // Enhanced vibration pattern
      if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
      }
    } catch (error) {
      console.log('Error playing notification:', error);
    }
  };

  const openGoogleMapsDirection = (lat: number, lng: number) => {
    // Detect platform
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    let mapsUrl = '';

    if (isIOS) {
      // Try Google Maps app first, fallback to Apple Maps
      mapsUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
      
      // Fallback to Apple Maps
      setTimeout(() => {
        window.location.href = `maps://maps.apple.com/?daddr=${lat},${lng}`;
      }, 500);
    } else if (isAndroid) {
      // Android Google Maps
      mapsUrl = `google.navigation:q=${lat},${lng}&mode=d`;
    } else {
      // Web fallback
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }

    console.log('🗺️ Opening Google Maps:', mapsUrl);
    window.location.href = mapsUrl;
  };


  const getGpsStatusColor = () => {
    switch (gpsStatus) {
      case 'active': return 'text-green-500';
      case 'inactive': return 'text-yellow-500';
      case 'error': return 'text-red-500';
    }
  };

  const getGpsStatusIcon = () => {
    switch (gpsStatus) {
      case 'active': return '🟢';
      case 'inactive': return '🟡';
      case 'error': return '🔴';
    }
  };

  const formatLastUpdate = () => {
    if (!lastGpsUpdate) return 'Belum tersedia';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastGpsUpdate.getTime()) / 1000);
    
    if (diff < 60) return `${diff} detik lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    return lastGpsUpdate.toLocaleTimeString('id-ID');
  };

  const handleManualGpsUpdate = () => {
    toast.info('Memperbarui lokasi GPS...');
    updateLocation();
  };

  // Subscribe to pending orders
  useEffect(() => {
    if (!riderProfile?.id) {
      return () => {}; // ✅ Always return cleanup, even if empty
    }
    
    const fetchPendingOrdersWithDetails = async () => {
      console.log('🔍 Fetching pending orders for rider_profile_id:', riderProfile.id);
      
      const { data } = await supabase
        .from('customer_orders')
        .select(`
          *,
          customer_users!customer_orders_user_id_fkey(
            name,
            phone,
            address,
            photo_url
          ),
          customer_order_items(
            id,
            product_id,
            quantity,
            price,
            products(name, code)
          )
        `)
        .eq('rider_profile_id', riderProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      console.log('📦 Fetched pending orders:', data?.length || 0);
      
      if (data && data.length > 0) {
        // Show first order in dialog
        setCurrentOrder(data[0]);
        setShowOrderDialog(true);
        
        // Play notification sound
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.3;
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
          
          if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500, 200, 500]);
          }
        } catch (error) {
          console.log('Sound play error:', error);
        }
        
        // Show toast
        toast.info(`Pesanan baru dari ${data[0].customer_users.name}!`, {
          duration: 5000
        });
      }
    };
    
    fetchPendingOrdersWithDetails();
    
    // Subscribe to new pending orders
    const channel = supabase
      .channel('rider_pending_orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_orders',
          filter: `rider_profile_id=eq.${riderProfile.id}`
        },
        (payload) => {
          console.log('🔔 INSERT event received in rider_pending_orders channel:', payload);
          fetchPendingOrdersWithDetails();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [riderProfile]);

  const handleAcceptOrder = async (orderId: string) => {
    if (!riderProfile) return;
    
    try {
      console.log('✅ Accepting order:', orderId);
      
      const { data, error } = await supabase.functions.invoke('rider-respond-order', {
        body: {
          order_id: orderId,
          rider_profile_id: riderProfile.id,
          action: 'accept'
        }
      });
      
      if (error) throw error;

      toast.success('Pesanan berhasil diterima!', {
        description: 'Membuka Google Maps untuk navigasi...'
      });

      // Close dialog
      setShowOrderDialog(false);
      setCurrentOrder(null);

      // Refresh pending orders
      fetchPendingOrders();

      // Navigate to customer location
      if (currentOrder?.latitude && currentOrder?.longitude) {
        openGoogleMapsDirection(currentOrder.latitude, currentOrder.longitude);
      }
    } catch (err: any) {
      console.error('❌ Error accepting order:', err);
      toast.error('Gagal menerima pesanan: ' + (err.message || 'Unknown error'));
    }
  };

  const handleRejectOrder = async (orderId: string, reason: string) => {
    if (!riderProfile) return;
    
    try {
      const { error } = await supabase.functions.invoke('rider-respond-order', {
        body: {
          order_id: orderId,
          rider_profile_id: riderProfile.id,
          action: 'reject',
          rejection_reason: reason
        }
      });
      
      if (error) throw error;
      
      toast.info('Pesanan ditolak');
      setShowOrderDialog(false);
      setCurrentOrder(null);
      fetchPendingOrders();
    } catch (err: any) {
      console.error('Error rejecting order:', err);
      toast.error(err.message || 'Gagal menolak pesanan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Sound Enable Banner */}
      {showSoundBanner && (
        <div className="fixed top-2 left-2 right-2 z-50">
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">Aktifkan suara notifikasi?</span>
            </div>
            <Button 
              size="sm" 
              onClick={() => { 
                unlockAudio(); 
                playAlertBeep({ times: 1, durationMs: 300, volume: 0.6 }); 
                setShowSoundBanner(false); 
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Aktifkan
            </Button>
          </div>
        </div>
      )}
      
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">
              Dashboard Rider
            </CardTitle>
            {pendingOrdersCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full animate-pulse">
                <span className="text-sm font-medium">
                  {pendingOrdersCount} Pesanan Baru
                </span>
              </div>
            )}
          </div>
          
          {/* GPS Status Indicator */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Navigation className={`h-5 w-5 ${getGpsStatusColor()}`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status GPS</span>
                  <span className={`text-xs ${getGpsStatusColor()}`}>
                    {getGpsStatusIcon()} {gpsStatus === 'active' ? 'Aktif' : gpsStatus === 'inactive' ? 'Standby' : 'Error'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Update: {formatLastUpdate()}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualGpsUpdate}
              className="h-8"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Stok Total</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center space-x-4">
                <Package className="h-6 w-6 text-muted-foreground" />
                <div className="text-2xl font-bold">{stats.totalStock}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Penjualan Hari Ini</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center space-x-4">
                <DollarSign className="h-6 w-6 text-muted-foreground" />
                <div className="text-2xl font-bold">Rp {stats.todaySales.toLocaleString('id-ID')}</div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaksi Hari Ini</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center space-x-4">
                <Clock className="h-6 w-6 text-muted-foreground" />
                <div className="text-2xl font-bold">{stats.todayTransactions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Customer Aktif</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center space-x-4">
              <Users className="h-6 w-6 text-muted-foreground" />
              <div className="text-2xl font-bold">{stats.activeCustomers}</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Sales Trend Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tren Penjualan (7 Hari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" style={{ fontSize: '12px' }} />
                  <YAxis style={{ fontSize: '12px' }} />
                  <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
                  <Line type="monotone" dataKey="sales" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        
        {/* Top Products */}
        {topProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Produk Terlaris
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <span className="text-sm font-medium">{product.name}</span>
                    <span className="text-sm text-muted-foreground">{product.quantity} pcs</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Manajemen Shift</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-between items-center">
            {hasActiveShift ? (
              <Button variant="destructive" onClick={handleShiftEnd}>
                Akhiri Shift
              </Button>
            ) : (
              <Button onClick={handleShiftStart}>Mulai Shift</Button>
            )}
          </CardContent>
        </Card>
        </CardContent>
      </Card>

      {/* Incoming Order Dialog using MobileIncomingOrder component */}
      <MobileIncomingOrder
        order={currentOrder}
        isOpen={showOrderDialog}
        onClose={() => {
          setShowOrderDialog(false);
          setCurrentOrder(null);
        }}
        onAccept={handleAcceptOrder}
        onReject={handleRejectOrder}
        riderLocation={riderLocation}
      />
    </div>
  );
};

export default MobileRiderDashboard;
