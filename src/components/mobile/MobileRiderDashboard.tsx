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
  MapPin, Users, Activity, Navigation, RefreshCw, Phone, BarChart3, Volume2, CalendarIcon
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
  
  // Stock Card State
  const [stockCardFilter, setStockCardFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customStockDateFrom, setCustomStockDateFrom] = useState<Date | undefined>(undefined);
  const [customStockDateTo, setCustomStockDateTo] = useState<Date | undefined>(undefined);
  const [stockCardData, setStockCardData] = useState<any[]>([]);
  const [stockCardStats, setStockCardStats] = useState({
    stockIn: 0,
    totalSales: 0,
    totalTransactions: 0,
    totalProductsSold: 0,
    avgTransaction: 0,
    remainingStock: 0
  });

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

      // Fetch today's sales with Jakarta timezone
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const { data: salesData, error: salesError } = await supabase
        .from('transactions')
        .select('final_amount, transaction_date')
        .eq('rider_id', riderId)
        .eq('is_voided', false)
        .gte('transaction_date', `${today}T00:00:00+07:00`)
        .lte('transaction_date', `${today}T23:59:59+07:00`);

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        toast.error('Gagal memuat data penjualan.');
        return;
      }

      const todaySales = salesData?.reduce((sum, order) => sum + (Number(order.final_amount) || 0), 0) || 0;
      const todayTransactions = salesData?.length || 0;

      // Fetch 30 days transaction data for chart
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: weekData } = await supabase
        .from('transactions')
        .select('id, final_amount, transaction_date')
        .eq('rider_id', riderId)
        .eq('is_voided', false)
        .gte('transaction_date', thirtyDaysAgo.toISOString())
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

  // Stock Card Helper Functions
  const getStockCardDateRange = () => {
    const today = new Date();
    const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

    switch (stockCardFilter) {
      case 'today':
        return { start: formatDate(today), end: formatDate(today) };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: formatDate(yesterday), end: formatDate(yesterday) };
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        return { start: formatDate(weekStart), end: formatDate(today) };
      case 'month':
        const monthStart = new Date(today);
        monthStart.setDate(monthStart.getDate() - 30);
        return { start: formatDate(monthStart), end: formatDate(today) };
      case 'custom':
        if (customStockDateFrom && customStockDateTo) {
          return { start: formatDate(customStockDateFrom), end: formatDate(customStockDateTo) };
        }
        return { start: formatDate(today), end: formatDate(today) };
      default:
        return { start: formatDate(today), end: formatDate(today) };
    }
  };

  const fetchStockCardData = async () => {
    if (!riderProfile?.id) return;

    const { start, end } = getStockCardDateRange();

    try {
      // Fetch stock movements (stock in)
      const { data: stockIn, error: stockInError } = await supabase
        .from('stock_movements')
        .select(`
          quantity,
          movement_type,
          product_id,
          products(name, cost_price)
        `)
        .eq('rider_id', riderProfile.id)
        .in('movement_type', ['transfer', 'in', 'adjustment'])
        .gte('created_at', `${start}T00:00:00+07:00`)
        .lte('created_at', `${end}T23:59:59+07:00`);

      if (stockInError) throw stockInError;

      // Fetch transactions (stock sold)
      const { data: transactions, error: transError } = await supabase
        .from('transaction_items')
        .select(`
          transactions!inner(created_at, rider_id, final_amount, is_voided),
          quantity,
          product_id,
          products(name, cost_price)
        `)
        .eq('transactions.rider_id', riderProfile.id)
        .eq('transactions.is_voided', false)
        .gte('transactions.created_at', `${start}T00:00:00+07:00`)
        .lte('transactions.created_at', `${end}T23:59:59+07:00`);

      if (transError) throw transError;

      // Fetch current inventory
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('product_id, stock_quantity, products(name, cost_price)')
        .eq('rider_id', riderProfile.id);

      if (invError) throw invError;

      // Fetch stock returns
      const { data: stockReturns, error: returnError } = await supabase
        .from('stock_movements')
        .select(`
          quantity,
          product_id,
          products(name, cost_price)
        `)
        .eq('rider_id', riderProfile.id)
        .in('movement_type', ['return', 'out'])
        .gte('created_at', `${start}T00:00:00+07:00`)
        .lte('created_at', `${end}T23:59:59+07:00`);

      if (returnError) throw returnError;

      // Process data by product
      const productMap = new Map<string, any>();

      // Process stock in
      let totalStockIn = 0;
      stockIn?.forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.products?.name || 'Unknown';

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_name: productName,
            stock_in: 0,
            stock_sold: 0,
            remaining_stock: 0,
            stock_returned: 0,
            stock_value: 0
          });
        }

        const existing = productMap.get(productId)!;
        existing.stock_in += item.quantity;
        totalStockIn += item.quantity;
        productMap.set(productId, existing);
      });

      // Process stock sold & calculate sales
      let totalSales = 0;
      let totalTransactions = 0;
      let totalProductsSold = 0;
      const transactionIds = new Set();

      transactions?.forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.products?.name || 'Unknown';

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_name: productName,
            stock_in: 0,
            stock_sold: 0,
            remaining_stock: 0,
            stock_returned: 0,
            stock_value: 0
          });
        }

        const existing = productMap.get(productId)!;
        existing.stock_sold += item.quantity;
        totalProductsSold += item.quantity;
        productMap.set(productId, existing);

        // Count unique transactions
        const txId = item.transactions.created_at; // Use as unique identifier
        if (!transactionIds.has(txId)) {
          transactionIds.add(txId);
          totalTransactions++;
          totalSales += item.transactions.final_amount || 0;
        }
      });

      // Process stock returned
      stockReturns?.forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.products?.name || 'Unknown';

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_name: productName,
            stock_in: 0,
            stock_sold: 0,
            remaining_stock: 0,
            stock_returned: 0,
            stock_value: 0
          });
        }

        const existing = productMap.get(productId)!;
        existing.stock_returned += item.quantity;
        productMap.set(productId, existing);
      });

      // Calculate remaining stock and value
      let totalRemainingStock = 0;
      productMap.forEach((item, productId) => {
        // Get cost price from inventory
        const invItem = inventory?.find((inv: any) => inv.product_id === productId);
        const costPrice = invItem?.products?.cost_price || 0;

        // Calculate remaining stock = stock_in - stock_sold
        item.remaining_stock = item.stock_in - item.stock_sold;
        
        // Calculate stock value = remaining_stock * cost_price
        item.stock_value = item.remaining_stock * costPrice;
        totalRemainingStock += item.remaining_stock;
      });

      const stockCardArray = Array.from(productMap.values())
        .filter(item => item.stock_in > 0 || item.stock_sold > 0 || item.remaining_stock > 0 || item.stock_returned > 0)
        .sort((a, b) => a.product_name.localeCompare(b.product_name));

      setStockCardData(stockCardArray);

      // Calculate stats
      const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
      setStockCardStats({
        stockIn: totalStockIn,
        totalSales,
        totalTransactions,
        totalProductsSold,
        avgTransaction,
        remainingStock: totalRemainingStock
      });

    } catch (error: any) {
      console.error('Error fetching stock card:', error);
      toast.error('Gagal memuat stock card');
    }
  };

  // Fetch stock card when filter changes
  useEffect(() => {
    if (riderProfile?.id) {
      fetchStockCardData();
    }
  }, [riderProfile, stockCardFilter, customStockDateFrom, customStockDateTo]);

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

      toast.success('Pesanan Diterima!', {
        description: 'Pesanan telah dikonfirmasi ke customer'
      });

      // Keep dialog open and show new buttons
      // DO NOT close dialog, DO NOT set currentOrder to null
      // DO NOT auto-redirect to Google Maps

      // Refresh pending orders
      fetchPendingOrders();
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
    <div className="container mx-auto p-4 space-y-4">
      {/* Sound Enable Banner */}
      {showSoundBanner && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Volume2 className="h-5 w-5 mr-2" />
              <p className="font-bold">Aktifkan Suara untuk Notifikasi Order</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                unlockAudio();
                setShowSoundBanner(false);
                localStorage.setItem('zeger-sound-enabled', 'true');
              }}
            >
              Aktifkan
            </Button>
          </div>
        </div>
      )}

      {/* GPS Status Card */}
      <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-red-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className={cn("h-5 w-5", getGpsStatusColor())} />
              <div>
                <CardTitle className="text-lg">Status GPS</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {getGpsStatusIcon()} {gpsStatus === 'active' ? 'Aktif' : gpsStatus === 'inactive' ? 'Tidak Aktif' : 'Error'}
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
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Update terakhir: {formatLastUpdate()}
          </p>
        </CardContent>
      </Card>

      {/* Filter Section */}
      <Card className="p-4">
        <div className="space-y-3">
          <Label>Filter Periode</Label>
          <Select value={stockCardFilter} onValueChange={(value: any) => setStockCardFilter(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="yesterday">Kemarin</SelectItem>
              <SelectItem value="week">Minggu Ini</SelectItem>
              <SelectItem value="month">Bulan Ini</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {stockCardFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Dari</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStockDateFrom ? format(customStockDateFrom, 'dd/MM/yy') : 'Pilih'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={customStockDateFrom} onSelect={setCustomStockDateFrom} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Sampai</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStockDateTo ? format(customStockDateTo, 'dd/MM/yy') : 'Pilih'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={customStockDateTo} onSelect={setCustomStockDateTo} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 6 Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Stock Masuk</p>
              <h3 className="text-2xl font-bold">{stockCardStats.stockIn}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Penjualan</p>
              <h3 className="text-lg font-bold">Rp {(stockCardStats.totalSales / 1000).toFixed(0)}k</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Transaksi</p>
              <h3 className="text-2xl font-bold">{stockCardStats.totalTransactions}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Produk Terjual</p>
              <h3 className="text-2xl font-bold">{stockCardStats.totalProductsSold}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 border-pink-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Rata2 Transaksi</p>
              <h3 className="text-lg font-bold">Rp {(stockCardStats.avgTransaction / 1000).toFixed(0)}k</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-pink-500 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 border-cyan-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Sisa Stock</p>
              <h3 className="text-2xl font-bold">{stockCardStats.remainingStock}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-cyan-500 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Sales Chart - 30 Days */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Grafik Penjualan (30 Hari)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" style={{ fontSize: '10px' }} />
                <YAxis style={{ fontSize: '10px' }} />
                <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
                <Line type="monotone" dataKey="sales" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Riwayat Stock Card Table */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 text-sm">Riwayat Stock Card</h3>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">No</TableHead>
                <TableHead className="text-xs">Nama Menu</TableHead>
                <TableHead className="text-xs text-right">Masuk</TableHead>
                <TableHead className="text-xs text-right">Terjual</TableHead>
                <TableHead className="text-xs text-right">Sisa</TableHead>
                <TableHead className="text-xs text-right">Kembali</TableHead>
                <TableHead className="text-xs text-right">Nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockCardData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-4">
                    Tidak ada data
                  </TableCell>
                </TableRow>
              ) : (
                stockCardData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs">{index + 1}</TableCell>
                    <TableCell className="text-xs font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-xs text-right">{item.stock_in}</TableCell>
                    <TableCell className="text-xs text-right">{item.stock_sold}</TableCell>
                    <TableCell className="text-xs text-right">{item.remaining_stock}</TableCell>
                    <TableCell className="text-xs text-right">{item.stock_returned}</TableCell>
                    <TableCell className="text-xs text-right">
                      {(item.stock_value / 1000).toFixed(0)}k
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Produk Terlaris
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                  <span className="text-xs font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground">{product.quantity} pcs</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shift Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manajemen Shift</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-between items-center">
          {hasActiveShift ? (
            <Button variant="destructive" onClick={handleShiftEnd} size="sm" className="w-full">
              Akhiri Shift
            </Button>
          ) : (
            <Button onClick={handleShiftStart} size="sm" className="w-full">
              Mulai Shift
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Incoming Order Dialog using MobileIncomingOrder component */}
      <MobileIncomingOrder
        order={currentOrder}
        isOpen={showOrderDialog}
        onClose={() => {
          setShowOrderDialog(false);
          // Don't set currentOrder to null if order is accepted
        }}
        onAccept={handleAcceptOrder}
        onReject={handleRejectOrder}
        riderLocation={riderLocation}
      />

      {/* Action buttons after order is accepted */}
      {currentOrder && !showOrderDialog && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 space-y-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg">Pesanan Aktif</h3>
            <span className="text-sm text-muted-foreground">
              Order #{currentOrder.id.slice(0, 8)}
            </span>
          </div>
          
          <Button
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              if (currentOrder && currentOrder.latitude && currentOrder.longitude) {
                openGoogleMapsDirection(currentOrder.latitude, currentOrder.longitude);
              } else {
                toast.error('Koordinat lokasi tidak tersedia');
              }
            }}
          >
            <MapPin className="h-5 w-5 mr-2" />
            Lihat Peta
          </Button>
          
          <Button
            size="lg"
            className="w-full bg-[#EA2831] hover:bg-red-700 text-white"
            onClick={async () => {
              if (!currentOrder) return;
              
              console.log('🚀 Marking order as delivered:', currentOrder.id);
              
              try {
                // Update order status to delivered
                const { error: updateError } = await supabase
                  .from('customer_orders')
                  .update({ 
                    status: 'delivered',
                    updated_at: new Date().toISOString() 
                  })
                  .eq('id', currentOrder.id);
                
                if (updateError) {
                  console.error('❌ Error updating order:', updateError);
                  toast.error('Gagal update status pesanan');
                  return;
                }

                // Add status history with location
                const currentLocation = riderLocation;
                const { error: historyError } = await supabase
                  .from('order_status_history')
                  .insert({
                    order_id: currentOrder.id,
                    status: 'delivered',
                    notes: 'Rider telah sampai',
                    latitude: currentLocation?.lat,
                    longitude: currentLocation?.lng
                  });

                if (historyError) {
                  console.error('❌ Error adding history:', historyError);
                }

                console.log('✅ Order marked as delivered successfully');
                
                toast.success('Pesanan Selesai!', {
                  description: 'Customer telah menerima pesanan'
                });
                
                setCurrentOrder(null);
                fetchDashboardData();
                fetchPendingOrders();
              } catch (error: any) {
                console.error('❌ Error in order completion:', error);
                toast.error('Gagal update status pesanan');
              }
            }}
          >
            <Package className="h-5 w-5 mr-2" />
            ✅ Sudah Sampai Lokasi
          </Button>
        </div>
      )}
    </div>
  );
};

export default MobileRiderDashboard;
