import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Package, Clock, DollarSign, TrendingUp,
  MapPin, Users, Activity, Navigation, RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const [loading, setLoading] = useState(true);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<'active' | 'inactive' | 'error'>('inactive');
  const [lastGpsUpdate, setLastGpsUpdate] = useState<Date | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (user) {
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

      return () => {
        stopLocationTracking();
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

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
          rider_id: profile.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
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
        toast.error('Failed to load profile data.');
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
        toast.error('Failed to load inventory data.');
        return;
      }

      const totalStock = inventoryData?.reduce((sum, item) => sum + (item.stock_quantity || 0), 0) || 0;

      // Fetch today's sales
      const today = new Date().toISOString().split('T')[0];
      const { data: salesData, error: salesError } = await supabase
        .from('transactions')
        .select('final_amount')
        .eq('rider_id', riderId)
        .gte('transaction_date', `${today}T00:00:00`)
        .lte('transaction_date', `${today}T23:59:59`);

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        toast.error('Failed to load sales data.');
        return;
      }

      const todaySales = salesData?.reduce((sum, order) => sum + (Number(order.final_amount) || 0), 0) || 0;
      const todayTransactions = salesData?.length || 0;

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
      toast.error('Failed to load dashboard data.');
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

      const { count, error } = await supabase
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('rider_id', profile.id)
        .eq('status', 'pending');

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">
              Rider Dashboard
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
                <CardTitle>Total Stock</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center space-x-4">
                <Package className="h-6 w-6 text-muted-foreground" />
                <div className="text-2xl font-bold">{stats.totalStock}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Today's Sales</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center space-x-4">
                <DollarSign className="h-6 w-6 text-muted-foreground" />
                <div className="text-2xl font-bold">${stats.todaySales.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Today's Transactions</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center space-x-4">
                <Clock className="h-6 w-6 text-muted-foreground" />
                <div className="text-2xl font-bold">{stats.todayTransactions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Active Customers</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center space-x-4">
                <Users className="h-6 w-6 text-muted-foreground" />
                <div className="text-2xl font-bold">{stats.activeCustomers}</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Shift Management</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              {hasActiveShift ? (
                <Button variant="destructive" onClick={handleShiftEnd}>
                  End Shift
                </Button>
              ) : (
                <Button onClick={handleShiftStart}>Start Shift</Button>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileRiderDashboard;
